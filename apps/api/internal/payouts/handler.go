package payouts

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/dare-app/api/pkg/apperr"
	"github.com/dare-app/api/pkg/middleware"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct{ db *pgxpool.Pool }

func NewHandler(db *pgxpool.Pool) *Handler {
	h := &Handler{db: db}
	h.ensureSchema()
	return h
}

func (h *Handler) ensureSchema() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if _, err := h.db.Exec(ctx, `ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_verified BOOLEAN NOT NULL DEFAULT FALSE`); err != nil {
		slog.Warn("payouts: kyc_verified column ensure failed", "err", err)
	}
}

func (h *Handler) Register(r chi.Router) {
	r.Get("/", h.List)
	r.Post("/request", h.Request)
	r.Get("/kyc-status", h.KYCStatus)
}

type PayoutResp struct {
	ID          int64    `json:"id"`
	AmountUSD   *float64 `json:"amountUsd,omitempty"`
	AmountINR   *float64 `json:"amountInr,omitempty"`
	Provider    string   `json:"provider"`
	ProviderRef string   `json:"providerRef,omitempty"`
	Status      string   `json:"status"`
	RequestedAt string   `json:"requestedAt"`
	PaidAt      *string  `json:"paidAt,omitempty"`
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserID(r.Context())
	if uid == 0 {
		apperr.Write(w, apperr.ErrUnauthorized)
		return
	}
	rows, err := h.db.Query(r.Context(), `
		SELECT id, amount_usd, amount_inr, provider, COALESCE(provider_ref,''), status, requested_at, paid_at
		FROM payouts WHERE user_id = $1 ORDER BY requested_at DESC LIMIT 100
	`, uid)
	if err != nil {
		apperr.Write(w, apperr.New(500, "db error"))
		return
	}
	defer rows.Close()

	result := []PayoutResp{}
	for rows.Next() {
		var p PayoutResp
		var requestedAt time.Time
		var paidAt *time.Time
		if err := rows.Scan(&p.ID, &p.AmountUSD, &p.AmountINR, &p.Provider, &p.ProviderRef, &p.Status, &requestedAt, &paidAt); err != nil {
			continue
		}
		p.RequestedAt = requestedAt.Format(time.RFC3339)
		if paidAt != nil {
			s := paidAt.Format(time.RFC3339)
			p.PaidAt = &s
		}
		result = append(result, p)
	}
	apperr.JSON(w, http.StatusOK, result)
}

type RequestBody struct {
	AmountUSD float64 `json:"amount_usd"`
	AmountINR float64 `json:"amount_inr"`
	Provider  string  `json:"provider"`
}

func (h *Handler) Request(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserID(r.Context())
	if uid == 0 {
		apperr.Write(w, apperr.ErrUnauthorized)
		return
	}

	var body RequestBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		apperr.Write(w, apperr.ErrBadRequest)
		return
	}
	if body.Provider != "stripe" && body.Provider != "razorpay" {
		apperr.Write(w, apperr.New(http.StatusBadRequest, "invalid provider"))
		return
	}
	if body.Provider == "stripe" && body.AmountUSD < 5 {
		apperr.Write(w, apperr.New(http.StatusBadRequest, "minimum payout is $5 USD"))
		return
	}
	if body.Provider == "razorpay" && body.AmountINR < 400 {
		apperr.Write(w, apperr.New(http.StatusBadRequest, "minimum payout is ₹400 INR"))
		return
	}

	neededCoins := coinsForPayout(body.Provider, body.AmountUSD, body.AmountINR, coinsPerUSD(), coinsPerINR())

	now := time.Now().Unix()
	var providerRef string
	var amountUSD, amountINR any
	if body.Provider == "stripe" {
		providerRef = fmt.Sprintf("stripe_%d", now)
		amountUSD, amountINR = body.AmountUSD, nil
	} else {
		providerRef = fmt.Sprintf("rzp_%d", now)
		amountUSD, amountINR = nil, body.AmountINR
	}

	// Authorize + debit atomically, guarding against concurrent double-spend: lock the
	// user row (FOR UPDATE) and read KYC + the real Coins balance INSIDE the tx, so two
	// simultaneous requests serialize — the second sees the first's committed debit.
	tx, err := h.db.Begin(r.Context())
	if err != nil {
		apperr.Write(w, apperr.New(500, "db error"))
		return
	}
	defer tx.Rollback(r.Context())

	var kycVerified bool
	var balanceCoins int64
	if err := tx.QueryRow(r.Context(), `
		SELECT COALESCE(u.kyc_verified, FALSE),
		       COALESCE((SELECT SUM(amount) FROM ledger WHERE user_id = u.id AND currency = 'coins'), 0)::bigint
		FROM users u WHERE u.id = $1
		FOR UPDATE
	`, uid).Scan(&kycVerified, &balanceCoins); err != nil {
		apperr.Write(w, apperr.ErrNotFound)
		return
	}

	if reason := withdrawDecision(balanceCoins, neededCoins, kycVerified); reason != "" {
		apperr.JSON(w, http.StatusForbidden, map[string]string{"error": reason})
		return
	}

	var id int64
	if err := tx.QueryRow(r.Context(), `
		INSERT INTO payouts (user_id, amount_usd, amount_inr, provider, provider_ref, status, kyc_verified)
		VALUES ($1, $2, $3, $4, $5, 'pending', TRUE)
		RETURNING id
	`, uid, amountUSD, amountINR, body.Provider, providerRef).Scan(&id); err != nil {
		apperr.Write(w, apperr.New(500, "db error"))
		return
	}
	if _, err := tx.Exec(r.Context(), `
		INSERT INTO ledger (user_id, currency, amount, reason, ref_id, created_at)
		VALUES ($1, 'coins', $2, 'payout', $3, NOW())
	`, uid, -neededCoins, fmt.Sprintf("%d", id)); err != nil {
		apperr.Write(w, apperr.New(500, "db error"))
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		apperr.Write(w, apperr.New(500, "db error"))
		return
	}

	slog.Info("payout authorized",
		"user_id", uid, "provider", body.Provider,
		"coins_debited", neededCoins, "balance_after", balanceCoins-neededCoins,
		"provider_ref", providerRef,
	)

	apperr.JSON(w, http.StatusOK, map[string]any{
		"id":           id,
		"providerRef":  providerRef,
		"provider":     body.Provider,
		"status":       "pending",
		"coinsDebited": neededCoins,
	})
}

func (h *Handler) KYCStatus(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserID(r.Context())
	if uid == 0 {
		apperr.Write(w, apperr.ErrUnauthorized)
		return
	}
	var verified bool
	err := h.db.QueryRow(r.Context(), `SELECT COALESCE(kyc_verified, FALSE) FROM users WHERE id = $1`, uid).Scan(&verified)
	if err != nil {
		apperr.Write(w, apperr.ErrNotFound)
		return
	}
	apperr.JSON(w, http.StatusOK, map[string]bool{"kycVerified": verified})
}

type kycWebhookBody struct {
	UserID   int64 `json:"userId"`
	Verified bool  `json:"verified"`
}

// KYCWebhook is called by the KYC provider (or back-office) — NOT by end users.
// It is gated by KYC_WEBHOOK_SECRET (constant-time, fails closed) and mounted
// outside the user-JWT group, so a user can never self-attest their own KYC.
func (h *Handler) KYCWebhook(w http.ResponseWriter, r *http.Request) {
	secret := os.Getenv("KYC_WEBHOOK_SECRET")
	got := r.Header.Get("X-KYC-Webhook-Secret")
	if len(secret) == 0 || subtle.ConstantTimeCompare([]byte(got), []byte(secret)) != 1 {
		apperr.Write(w, apperr.ErrUnauthorized)
		return
	}
	var body kycWebhookBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.UserID == 0 {
		apperr.Write(w, apperr.ErrBadRequest)
		return
	}
	if _, err := h.db.Exec(r.Context(), `UPDATE users SET kyc_verified = $1 WHERE id = $2`, body.Verified, body.UserID); err != nil {
		apperr.Write(w, apperr.New(500, "db error"))
		return
	}
	slog.Info("kyc updated via webhook", "user_id", body.UserID, "verified", body.Verified)
	apperr.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// coinsForPayout converts a requested cash amount to the Coins it costs, rounding up
// (so a withdrawal can never cost fewer Coins than its cash value).
func coinsForPayout(provider string, usd, inr float64, perUSD, perINR int64) int64 {
	if provider == "razorpay" {
		return int64(math.Ceil(inr * float64(perINR)))
	}
	return int64(math.Ceil(usd * float64(perUSD)))
}

// withdrawDecision returns "" when a withdrawal is authorized, else a machine-readable reason.
func withdrawDecision(balanceCoins, neededCoins int64, kyc bool) string {
	if !kyc {
		return "kyc_required"
	}
	if neededCoins <= 0 {
		return "invalid_amount"
	}
	if neededCoins > balanceCoins {
		return "insufficient_balance"
	}
	return ""
}

func coinsPerUSD() int64 { return envInt("COINS_PER_USD", 100) }
func coinsPerINR() int64 { return envInt("COINS_PER_INR", 1) }

func envInt(key string, def int64) int64 {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil && n > 0 {
			return n
		}
	}
	return def
}
