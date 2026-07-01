//go:build integration

// Integration tests for the payout money path against a real Postgres
// (testcontainers). Run with: go test -tags integration ./internal/payouts/...
package payouts

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/dare-app/api/pkg/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/testcontainers/testcontainers-go"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
)

func setupDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	ctx := context.Background()

	pgc, err := tcpostgres.Run(ctx, "postgres:16-alpine",
		tcpostgres.WithDatabase("dare"),
		tcpostgres.WithUsername("dare"),
		tcpostgres.WithPassword("dare"),
	)
	if err != nil {
		t.Fatalf("start postgres container: %v", err)
	}
	t.Cleanup(func() { _ = testcontainers.TerminateContainer(pgc) })

	dsn, err := pgc.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		t.Fatalf("connection string: %v", err)
	}

	var pool *pgxpool.Pool
	for i := 0; i < 30; i++ {
		if pool, err = pgxpool.New(ctx, dsn); err == nil && pool.Ping(ctx) == nil {
			break
		}
		if pool != nil {
			pool.Close()
			pool = nil
		}
		time.Sleep(time.Second)
	}
	if pool == nil {
		t.Fatalf("connect pool: %v", err)
	}
	t.Cleanup(pool.Close)

	// Apply the base schema migration.
	_, thisFile, _, _ := runtime.Caller(0)
	migPath := filepath.Join(filepath.Dir(thisFile), "..", "..", "..", "..", "infra", "migrations", "001_initial.up.sql")
	sqlBytes, err := os.ReadFile(migPath)
	if err != nil {
		t.Fatalf("read migration %s: %v", migPath, err)
	}
	if _, err := pool.Exec(ctx, string(sqlBytes)); err != nil {
		t.Fatalf("apply migration: %v", err)
	}
	return pool
}

func asUser(req *http.Request, userID int64) *http.Request {
	return req.WithContext(context.WithValue(req.Context(), middleware.ClaimsKey, &middleware.Claims{UserID: userID}))
}

func coinsBalance(t *testing.T, pool *pgxpool.Pool, userID int64) int64 {
	t.Helper()
	var bal int64
	if err := pool.QueryRow(context.Background(),
		`SELECT COALESCE(SUM(amount),0)::bigint FROM ledger WHERE user_id=$1 AND currency='coins'`, userID).Scan(&bal); err != nil {
		t.Fatalf("balance query: %v", err)
	}
	return bal
}

// TestPayoutsIntegration exercises the full money path: KYC must come from the
// secret-gated webhook, payouts are balance-checked against the Coins ledger, and
// the debit is atomic (a balance can't be drained twice).
func TestPayoutsIntegration(t *testing.T) {
	pool := setupDB(t)
	ctx := context.Background()
	t.Setenv("KYC_WEBHOOK_SECRET", "wh-secret") // COINS_PER_USD defaults to 100 -> $1 = 100 Coins

	h := NewHandler(pool) // ensureSchema adds kyc_verified

	// Seed: user 1 with 1000 Coins (= $10 at the default rate).
	if _, err := pool.Exec(ctx, `INSERT INTO users (id, firebase_uid, phone) VALUES (1,'fb1','+910000000001')`); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO ledger (user_id, currency, amount, reason) VALUES (1,'coins',1000,'seed')`); err != nil {
		t.Fatalf("seed ledger: %v", err)
	}

	kycWebhook := func(secret, body string) int {
		req := httptest.NewRequest(http.MethodPost, "/webhooks/kyc", strings.NewReader(body))
		req.Header.Set("X-KYC-Webhook-Secret", secret)
		rr := httptest.NewRecorder()
		h.KYCWebhook(rr, req)
		return rr.Code
	}
	payoutRequest := func(body string) (int, string) {
		req := asUser(httptest.NewRequest(http.MethodPost, "/api/payouts/request", strings.NewReader(body)), 1)
		rr := httptest.NewRecorder()
		h.Request(rr, req)
		return rr.Code, rr.Body.String()
	}

	// KYC webhook is secret-gated.
	if code := kycWebhook("wrong", `{"userId":1,"verified":true}`); code != http.StatusUnauthorized {
		t.Fatalf("wrong-secret webhook = %d, want 401", code)
	}

	// No KYC yet -> payout blocked.
	if code, body := payoutRequest(`{"amount_usd":5,"provider":"stripe"}`); code != http.StatusForbidden || !strings.Contains(body, "kyc_required") {
		t.Fatalf("pre-KYC payout = %d %s, want 403 kyc_required", code, body)
	}

	// Provider/back-office verifies KYC via the webhook.
	if code := kycWebhook("wh-secret", `{"userId":1,"verified":true}`); code != http.StatusOK {
		t.Fatalf("webhook = %d, want 200", code)
	}

	// Over balance ($11 > $10) -> rejected, nothing debited.
	if code, body := payoutRequest(`{"amount_usd":11,"provider":"stripe"}`); code != http.StatusForbidden || !strings.Contains(body, "insufficient_balance") {
		t.Fatalf("over-balance payout = %d %s, want 403 insufficient_balance", code, body)
	}
	if bal := coinsBalance(t, pool, 1); bal != 1000 {
		t.Fatalf("balance after rejected payout = %d, want 1000", bal)
	}

	// Valid $6 (= 600 Coins) -> 200, debited, balance now 400.
	if code, body := payoutRequest(`{"amount_usd":6,"provider":"stripe"}`); code != http.StatusOK {
		t.Fatalf("valid payout = %d %s, want 200", code, body)
	}
	if bal := coinsBalance(t, pool, 1); bal != 400 {
		t.Fatalf("balance after $6 payout = %d, want 400", bal)
	}

	// Second $5 (= 500 Coins) exceeds the remaining 400 -> rejected, balance unchanged (no double-spend).
	if code, body := payoutRequest(`{"amount_usd":5,"provider":"stripe"}`); code != http.StatusForbidden || !strings.Contains(body, "insufficient_balance") {
		t.Fatalf("second payout = %d %s, want 403 insufficient_balance", code, body)
	}
	if bal := coinsBalance(t, pool, 1); bal != 400 {
		t.Fatalf("balance after second (rejected) payout = %d, want 400", bal)
	}
}

// TestPayoutConcurrentNoDoubleSpend fires many simultaneous payout requests against a
// balance that can only cover one, and asserts exactly one succeeds (FOR UPDATE serialization).
func TestPayoutConcurrentNoDoubleSpend(t *testing.T) {
	pool := setupDB(t)
	ctx := context.Background()
	t.Setenv("KYC_WEBHOOK_SECRET", "wh-secret")
	h := NewHandler(pool)

	// User with 1000 Coins (= $10) and KYC verified. Each request asks for $6 (600 Coins),
	// so at most ONE can succeed; a second would overdraw.
	if _, err := pool.Exec(ctx, `INSERT INTO users (id, firebase_uid, phone, kyc_verified) VALUES (1,'fb1','+910000000001', TRUE)`); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO ledger (user_id, currency, amount, reason) VALUES (1,'coins',1000,'seed')`); err != nil {
		t.Fatalf("seed ledger: %v", err)
	}

	const n = 8
	var wg sync.WaitGroup
	codes := make([]int, n)
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			req := asUser(httptest.NewRequest(http.MethodPost, "/api/payouts/request", strings.NewReader(`{"amount_usd":6,"provider":"stripe"}`)), 1)
			rr := httptest.NewRecorder()
			h.Request(rr, req)
			codes[idx] = rr.Code
		}(i)
	}
	wg.Wait()

	success := 0
	for _, c := range codes {
		if c == http.StatusOK {
			success++
		}
	}
	if success != 1 {
		t.Fatalf("concurrent payouts: %d succeeded, want exactly 1 (codes=%v)", success, codes)
	}
	if bal := coinsBalance(t, pool, 1); bal != 400 {
		t.Fatalf("balance after concurrent payouts = %d, want 400 (never negative / double-spent)", bal)
	}
}
