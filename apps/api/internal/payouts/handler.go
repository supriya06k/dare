package payouts

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
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
	r.Post("/kyc-complete", h.KYCComplete)
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

	var kycVerified bool
	var contributionScore int
	err := h.db.QueryRow(r.Context(), `
		SELECT COALESCE(kyc_verified, FALSE), (challenges*5 + votes_given)
		FROM users WHERE id = $1
	`, uid).Scan(&kycVerified, &contributionScore)
	if err != nil {
		apperr.Write(w, apperr.ErrNotFound)
		return
	}
	if !kycVerified {
		apperr.JSON(w, http.StatusForbidden, map[string]string{"error": "kyc_required"})
		return
	}
	if contributionScore <= 0 {
		apperr.JSON(w, http.StatusForbidden, map[string]string{"error": "no_earnings"})
		return
	}

	now := time.Now().Unix()
	var providerRef string
	var amountUSD, amountINR any
	if body.Provider == "stripe" {
		providerRef = fmt.Sprintf("stripe_%d", now)
		amountUSD = body.AmountUSD
		amountINR = nil
	} else {
		providerRef = fmt.Sprintf("rzp_%d", now)
		amountUSD = nil
		amountINR = body.AmountINR
	}

	slog.Info("payout requested",
		"user_id", uid,
		"provider", body.Provider,
		"amount_usd", body.AmountUSD,
		"amount_inr", body.AmountINR,
		"provider_ref", providerRef,
	)

	var id int64
	err = h.db.QueryRow(r.Context(), `
		INSERT INTO payouts (user_id, amount_usd, amount_inr, provider, provider_ref, status, kyc_verified)
		VALUES ($1, $2, $3, $4, $5, 'pending', TRUE)
		RETURNING id
	`, uid, amountUSD, amountINR, body.Provider, providerRef).Scan(&id)
	if err != nil {
		apperr.Write(w, apperr.New(500, "db error"))
		return
	}

	apperr.JSON(w, http.StatusOK, map[string]any{
		"id":           id,
		"providerRef":  providerRef,
		"provider":     body.Provider,
		"status":       "pending",
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

func (h *Handler) KYCComplete(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserID(r.Context())
	if uid == 0 {
		apperr.Write(w, apperr.ErrUnauthorized)
		return
	}
	if _, err := h.db.Exec(r.Context(), `UPDATE users SET kyc_verified = TRUE WHERE id = $1`, uid); err != nil {
		apperr.Write(w, apperr.New(500, "db error"))
		return
	}
	apperr.JSON(w, http.StatusOK, map[string]bool{"kycVerified": true})
}
