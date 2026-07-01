// Package config holds the typed application configuration, loaded once at startup
// from the environment. Domains take the sub-struct they need (e.g. Payouts) rather
// than calling os.Getenv ad hoc in handlers — so config is validated in one place,
// read once, and easy to inject in tests.
package config

import (
	"os"
	"strconv"
)

// Config is the root application configuration.
type Config struct {
	Payouts Payouts
}

// Payouts holds payout/economy configuration.
type Payouts struct {
	CoinsPerUSD      int64  // Coins per 1 USD (default 100 => 1 Coin = $0.01)
	CoinsPerINR      int64  // Coins per 1 INR (default 1)
	KYCWebhookSecret string // shared secret gating POST /webhooks/kyc; empty => KYC updates fail closed
}

// Load reads configuration from the environment once, applying safe defaults.
func Load() Config {
	return Config{
		Payouts: Payouts{
			CoinsPerUSD:      envInt("COINS_PER_USD", 100),
			CoinsPerINR:      envInt("COINS_PER_INR", 1),
			KYCWebhookSecret: os.Getenv("KYC_WEBHOOK_SECRET"),
		},
	}
}

func envInt(key string, def int64) int64 {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil && n > 0 {
			return n
		}
	}
	return def
}
