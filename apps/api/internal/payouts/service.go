package payouts

import (
	"context"
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/dare-app/api/pkg/config"
)

// Domain errors returned by the service; the handler maps these to HTTP status.
var (
	ErrInvalidProvider     = errors.New("invalid_provider")
	ErrBelowMinimum        = errors.New("below_minimum")
	ErrInvalidAmount       = errors.New("invalid_amount")
	ErrKYCRequired         = errors.New("kyc_required")
	ErrInsufficientBalance = errors.New("insufficient_balance")
)

// Service holds the payout business logic. It depends on the Store (data access)
// and typed config — never on HTTP or the environment — so it is unit-testable and
// the transaction/authorization rules live in one place.
type Service struct {
	store *Store
	cfg   config.Payouts
}

func NewService(store *Store, cfg config.Payouts) *Service {
	return &Service{store: store, cfg: cfg}
}

// RequestInput is a validated payout request.
type RequestInput struct {
	Provider  string
	AmountUSD float64
	AmountINR float64
}

// RequestResult is the outcome of an authorized payout.
type RequestResult struct {
	ID           int64
	Provider     string
	ProviderRef  string
	CoinsDebited int64
}

// RequestPayout authorizes and records a payout, debiting the user's Coins balance
// atomically. Concurrent requests for the same user are serialized by the store's
// row lock, so a balance can never be withdrawn twice.
func (svc *Service) RequestPayout(ctx context.Context, userID int64, in RequestInput) (*RequestResult, error) {
	if in.Provider != "stripe" && in.Provider != "razorpay" {
		return nil, ErrInvalidProvider
	}
	if in.Provider == "stripe" && in.AmountUSD < 5 {
		return nil, ErrBelowMinimum
	}
	if in.Provider == "razorpay" && in.AmountINR < 400 {
		return nil, ErrBelowMinimum
	}

	needed := coinsForPayout(in.Provider, in.AmountUSD, in.AmountINR, svc.cfg.CoinsPerUSD, svc.cfg.CoinsPerINR)

	tx, err := svc.store.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) // no-op after Commit

	kyc, balance, err := svc.store.LockUserForWithdrawal(ctx, tx, userID)
	if err != nil {
		return nil, err
	}
	if err := authorizeWithdrawal(balance, needed, kyc); err != nil {
		return nil, err
	}

	ref := providerRef(in.Provider, time.Now())
	ins := PayoutInsert{UserID: userID, Provider: in.Provider, ProviderRef: ref}
	if in.Provider == "stripe" {
		ins.AmountUSD = &in.AmountUSD
	} else {
		ins.AmountINR = &in.AmountINR
	}

	id, err := svc.store.InsertPayout(ctx, tx, ins)
	if err != nil {
		return nil, err
	}
	if err := svc.store.InsertCoinsDelta(ctx, tx, userID, -needed, "payout", fmt.Sprintf("%d", id)); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &RequestResult{ID: id, Provider: in.Provider, ProviderRef: ref, CoinsDebited: needed}, nil
}

// SetKYC updates a user's KYC-verified flag (called from the gated webhook).
func (svc *Service) SetKYC(ctx context.Context, userID int64, verified bool) error {
	return svc.store.SetKYC(ctx, userID, verified)
}

// KYCStatus reports whether the user is KYC-verified.
func (svc *Service) KYCStatus(ctx context.Context, userID int64) (bool, error) {
	return svc.store.KYCVerified(ctx, userID)
}

// ListPayouts returns a user's payout history.
func (svc *Service) ListPayouts(ctx context.Context, userID int64) ([]Payout, error) {
	return svc.store.ListPayouts(ctx, userID)
}

// WebhookSecret returns the configured KYC webhook secret (empty => fail closed).
func (svc *Service) WebhookSecret() string { return svc.cfg.KYCWebhookSecret }

// coinsForPayout converts a requested cash amount to the Coins it costs, rounding up
// (so a withdrawal can never cost fewer Coins than its cash value).
func coinsForPayout(provider string, usd, inr float64, perUSD, perINR int64) int64 {
	if provider == "razorpay" {
		return int64(math.Ceil(inr * float64(perINR)))
	}
	return int64(math.Ceil(usd * float64(perUSD)))
}

// authorizeWithdrawal returns nil when a withdrawal is allowed, else a domain error.
func authorizeWithdrawal(balanceCoins, neededCoins int64, kyc bool) error {
	if !kyc {
		return ErrKYCRequired
	}
	if neededCoins <= 0 {
		return ErrInvalidAmount
	}
	if neededCoins > balanceCoins {
		return ErrInsufficientBalance
	}
	return nil
}

func providerRef(provider string, t time.Time) string {
	if provider == "razorpay" {
		return fmt.Sprintf("rzp_%d", t.Unix())
	}
	return fmt.Sprintf("stripe_%d", t.Unix())
}
