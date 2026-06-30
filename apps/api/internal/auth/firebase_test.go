package auth

import (
	"context"
	"testing"
)

// TestVerifyFirebaseToken_DevAuthGate verifies the dev-auth path fails closed:
// with no Firebase credentials, stub tokens are accepted ONLY when ALLOW_DEV_AUTH=true.
func TestVerifyFirebaseToken_DevAuthGate(t *testing.T) {
	ctx := context.Background()
	t.Setenv("FIREBASE_CREDENTIALS_FILE", "")

	// Dev auth NOT opted in -> must fail closed (never silently accept a stub token).
	t.Setenv("ALLOW_DEV_AUTH", "")
	if _, _, err := verifyFirebaseToken(ctx, "dev:phone:+919999999999"); err == nil {
		t.Fatal("expected error when auth is unconfigured (fail closed), got nil")
	}

	// Dev auth opted in -> a well-formed dev token is accepted.
	t.Setenv("ALLOW_DEV_AUTH", "true")
	phone, uid, err := verifyFirebaseToken(ctx, "dev:phone:+919999999999")
	if err != nil {
		t.Fatalf("expected dev token accepted, got %v", err)
	}
	if phone != "+919999999999" {
		t.Errorf("phone=%q want +919999999999", phone)
	}
	if uid != "dev-+919999999999" {
		t.Errorf("uid=%q want dev-+919999999999", uid)
	}

	// Dev auth opted in but a malformed token -> error.
	if _, _, err := verifyFirebaseToken(ctx, "garbage"); err == nil {
		t.Error("expected error for malformed dev token")
	}
}
