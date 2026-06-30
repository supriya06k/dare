package payouts

import "testing"

// TestCoinsForPayout locks the Coins<->cash conversion (default 1 Coin = $0.01 / ₹1),
// rounding up so a withdrawal never costs fewer Coins than its cash value.
func TestCoinsForPayout(t *testing.T) {
	const perUSD, perINR = int64(100), int64(1)
	cases := []struct {
		name       string
		provider   string
		usd, inr   float64
		want       int64
	}{
		{"stripe $5", "stripe", 5, 0, 500},
		{"stripe $12.34", "stripe", 12.34, 0, 1234},
		{"stripe rounds up", "stripe", 0.001, 0, 1},
		{"razorpay ₹400", "razorpay", 0, 400, 400},
		{"razorpay rounds up", "razorpay", 0, 99.5, 100},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := coinsForPayout(c.provider, c.usd, c.inr, perUSD, perINR); got != c.want {
				t.Fatalf("coinsForPayout(%s, $%v, ₹%v) = %d, want %d", c.provider, c.usd, c.inr, got, c.want)
			}
		})
	}
}

// TestWithdrawDecision locks the payout authorization rule: KYC required, positive
// amount, and never more than the Coins balance.
func TestWithdrawDecision(t *testing.T) {
	cases := []struct {
		name      string
		bal, need int64
		kyc       bool
		want      string
	}{
		{"no kyc blocks", 1000, 100, false, "kyc_required"},
		{"zero amount", 1000, 0, true, "invalid_amount"},
		{"over balance", 100, 101, true, "insufficient_balance"},
		{"exact balance ok", 100, 100, true, ""},
		{"within balance ok", 1000, 300, true, ""},
		{"no kyc takes precedence over balance", 0, 100, false, "kyc_required"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := withdrawDecision(c.bal, c.need, c.kyc); got != c.want {
				t.Fatalf("withdrawDecision(bal=%d, need=%d, kyc=%v) = %q, want %q", c.bal, c.need, c.kyc, got, c.want)
			}
		})
	}
}
