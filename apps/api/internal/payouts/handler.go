package payouts

import (
	"crypto/subtle"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/dare-app/api/pkg/apperr"
	"github.com/dare-app/api/pkg/middleware"
	"github.com/go-chi/chi/v5"
)

// Handler is the HTTP layer for payouts: it decodes/authenticates, delegates to the
// Service, and maps domain results/errors to HTTP. It contains no SQL and no
// business rules.
type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) Register(r chi.Router) {
	r.Get("/", h.List)
	r.Post("/request", h.Request)
	r.Get("/kyc-status", h.KYCStatus)
}

type payoutResp struct {
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
	payouts, err := h.svc.ListPayouts(r.Context(), uid)
	if err != nil {
		slog.Error("payouts: list failed", "user_id", uid, "err", err)
		apperr.Write(w, apperr.New(http.StatusInternalServerError, "db error"))
		return
	}
	out := make([]payoutResp, 0, len(payouts))
	for _, p := range payouts {
		resp := payoutResp{
			ID: p.ID, AmountUSD: p.AmountUSD, AmountINR: p.AmountINR,
			Provider: p.Provider, ProviderRef: p.ProviderRef, Status: p.Status,
			RequestedAt: p.RequestedAt.Format(time.RFC3339),
		}
		if p.PaidAt != nil {
			s := p.PaidAt.Format(time.RFC3339)
			resp.PaidAt = &s
		}
		out = append(out, resp)
	}
	apperr.JSON(w, http.StatusOK, out)
}

type requestBody struct {
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
	var body requestBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		apperr.Write(w, apperr.ErrBadRequest)
		return
	}

	res, err := h.svc.RequestPayout(r.Context(), uid, RequestInput{
		Provider: body.Provider, AmountUSD: body.AmountUSD, AmountINR: body.AmountINR,
	})
	if err != nil {
		writeRequestError(w, uid, err)
		return
	}

	slog.Info("payout authorized",
		"user_id", uid, "provider", res.Provider,
		"coins_debited", res.CoinsDebited, "provider_ref", res.ProviderRef,
	)
	apperr.JSON(w, http.StatusOK, map[string]any{
		"id":           res.ID,
		"providerRef":  res.ProviderRef,
		"provider":     res.Provider,
		"status":       "pending",
		"coinsDebited": res.CoinsDebited,
	})
}

// writeRequestError maps payout domain errors to HTTP responses.
func writeRequestError(w http.ResponseWriter, uid int64, err error) {
	switch {
	case errors.Is(err, ErrInvalidProvider), errors.Is(err, ErrBelowMinimum):
		apperr.Write(w, apperr.New(http.StatusBadRequest, err.Error()))
	case errors.Is(err, ErrKYCRequired), errors.Is(err, ErrInsufficientBalance), errors.Is(err, ErrInvalidAmount):
		apperr.JSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
	default:
		slog.Error("payouts: request failed", "user_id", uid, "err", err)
		apperr.Write(w, apperr.New(http.StatusInternalServerError, "db error"))
	}
}

func (h *Handler) KYCStatus(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserID(r.Context())
	if uid == 0 {
		apperr.Write(w, apperr.ErrUnauthorized)
		return
	}
	verified, err := h.svc.KYCStatus(r.Context(), uid)
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
// Gated by the configured webhook secret (constant-time, fails closed) and mounted
// outside the user-JWT group, so a user can never self-attest their own KYC.
func (h *Handler) KYCWebhook(w http.ResponseWriter, r *http.Request) {
	secret := h.svc.WebhookSecret()
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
	if err := h.svc.SetKYC(r.Context(), body.UserID, body.Verified); err != nil {
		slog.Error("payouts: set kyc failed", "user_id", body.UserID, "err", err)
		apperr.Write(w, apperr.New(http.StatusInternalServerError, "db error"))
		return
	}
	slog.Info("kyc updated via webhook", "user_id", body.UserID, "verified", body.Verified)
	apperr.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}
