package verification

import "testing"

// TestVerifiedByCrowd locks down the resolver's quorum + consensus rule:
// a window verifies only with at least QuorumMinVotes votes AND a PASS share
// at/above CrowdOverrideThreshold; otherwise it is crowd-rejected.
func TestVerifiedByCrowd(t *testing.T) {
	cases := []struct {
		name       string
		pass, fail int
		want       bool
	}{
		{"no votes", 0, 0, false},
		{"single pass below quorum", 1, 0, false},
		{"below quorum all pass", 2, 0, false},
		{"quorum exactly, all pass", 3, 0, true},
		{"quorum, exactly at threshold", 3, 2, true},   // 3/5 = 0.60
		{"quorum, below threshold", 2, 3, false},        // 2/5 = 0.40
		{"even split fails threshold", 5, 5, false},     // 0.50
		{"clear pass above threshold", 6, 4, true},      // 0.60
		{"unanimous fail", 0, 4, false},
	}
	for _, c := range cases {
		if got := verifiedByCrowd(c.pass, c.fail); got != c.want {
			t.Errorf("%s: verifiedByCrowd(pass=%d, fail=%d) = %v, want %v",
				c.name, c.pass, c.fail, got, c.want)
		}
	}
}
