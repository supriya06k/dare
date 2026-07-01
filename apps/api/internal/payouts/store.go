package payouts

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Store is the payouts data-access layer. It owns all payout/KYC/ledger SQL.
// Transaction-scoped methods take a pgx.Tx so the service can compose atomic
// operations (e.g. lock-read-then-debit); the rest use the pool directly.
type Store struct{ pool *pgxpool.Pool }

func NewStore(pool *pgxpool.Pool) *Store { return &Store{pool: pool} }

// Begin starts a transaction for a multi-statement atomic operation.
func (s *Store) Begin(ctx context.Context) (pgx.Tx, error) { return s.pool.Begin(ctx) }

// Payout is a persisted payout row.
type Payout struct {
	ID          int64
	AmountUSD   *float64
	AmountINR   *float64
	Provider    string
	ProviderRef string
	Status      string
	RequestedAt time.Time
	PaidAt      *time.Time
}

// PayoutInsert is the data needed to create a pending payout.
type PayoutInsert struct {
	UserID      int64
	AmountUSD   *float64
	AmountINR   *float64
	Provider    string
	ProviderRef string
}

// LockUserForWithdrawal locks the user row (FOR UPDATE) and returns KYC status + the
// Coins ledger balance, serializing concurrent withdrawals for the same user so a
// balance can never be read-and-spent twice.
func (s *Store) LockUserForWithdrawal(ctx context.Context, tx pgx.Tx, userID int64) (kycVerified bool, balanceCoins int64, err error) {
	err = tx.QueryRow(ctx, `
		SELECT COALESCE(u.kyc_verified, FALSE),
		       COALESCE((SELECT SUM(amount) FROM ledger WHERE user_id = u.id AND currency = 'coins'), 0)::bigint
		FROM users u WHERE u.id = $1
		FOR UPDATE
	`, userID).Scan(&kycVerified, &balanceCoins)
	return
}

// InsertPayout inserts a pending payout and returns its id.
func (s *Store) InsertPayout(ctx context.Context, tx pgx.Tx, in PayoutInsert) (int64, error) {
	var id int64
	err := tx.QueryRow(ctx, `
		INSERT INTO payouts (user_id, amount_usd, amount_inr, provider, provider_ref, status, kyc_verified)
		VALUES ($1, $2, $3, $4, $5, 'pending', TRUE)
		RETURNING id
	`, in.UserID, in.AmountUSD, in.AmountINR, in.Provider, in.ProviderRef).Scan(&id)
	return id, err
}

// InsertCoinsDelta appends a Coins ledger entry (negative = debit).
func (s *Store) InsertCoinsDelta(ctx context.Context, tx pgx.Tx, userID, delta int64, reason, refID string) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO ledger (user_id, currency, amount, reason, ref_id, created_at)
		VALUES ($1, 'coins', $2, $3, $4, NOW())
	`, userID, delta, reason, refID)
	return err
}

// SetKYC sets the user's KYC-verified flag.
func (s *Store) SetKYC(ctx context.Context, userID int64, verified bool) error {
	_, err := s.pool.Exec(ctx, `UPDATE users SET kyc_verified = $1 WHERE id = $2`, verified, userID)
	return err
}

// KYCVerified reports whether the user is KYC-verified.
func (s *Store) KYCVerified(ctx context.Context, userID int64) (bool, error) {
	var v bool
	err := s.pool.QueryRow(ctx, `SELECT COALESCE(kyc_verified, FALSE) FROM users WHERE id = $1`, userID).Scan(&v)
	return v, err
}

// ListPayouts returns a user's payouts, newest first.
func (s *Store) ListPayouts(ctx context.Context, userID int64) ([]Payout, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, amount_usd, amount_inr, provider, COALESCE(provider_ref,''), status, requested_at, paid_at
		FROM payouts WHERE user_id = $1 ORDER BY requested_at DESC LIMIT 100
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Payout{}
	for rows.Next() {
		var p Payout
		if err := rows.Scan(&p.ID, &p.AmountUSD, &p.AmountINR, &p.Provider, &p.ProviderRef, &p.Status, &p.RequestedAt, &p.PaidAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}
