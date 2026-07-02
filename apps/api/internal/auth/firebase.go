package auth

import (
	"context"
	"fmt"
	"os"

	firebase "firebase.google.com/go/v4"
	"google.golang.org/api/option"
)

// verifyFirebaseToken validates the token from the mobile client and returns
// the user's phone number and Firebase UID.
func verifyFirebaseToken(ctx context.Context, idToken string) (phone, uid string, err error) {
	credFile := os.Getenv("FIREBASE_CREDENTIALS_FILE")
	if credFile == "" {
		// No Firebase credentials configured. Only accept dev stub tokens when dev auth
		// is explicitly opted in — never silently fall open in a deployed environment.
		if os.Getenv("ALLOW_DEV_AUTH") == "true" {
			return devTokenParse(idToken)
		}
		return "", "", fmt.Errorf("auth not configured: set FIREBASE_CREDENTIALS_FILE (or ALLOW_DEV_AUTH=true for local dev)")
	}

	app, err := firebase.NewApp(ctx, nil, option.WithCredentialsFile(credFile))
	if err != nil {
		return "", "", fmt.Errorf("firebase init: %w", err)
	}
	client, err := app.Auth(ctx)
	if err != nil {
		return "", "", fmt.Errorf("firebase auth: %w", err)
	}
	tok, err := client.VerifyIDToken(ctx, idToken)
	if err != nil {
		return "", "", fmt.Errorf("verify token: %w", err)
	}
	phoneRaw, _ := tok.Claims["phone_number"].(string)
	return phoneRaw, tok.UID, nil
}

// devTokenParse — local dev only, never runs in production.
// Accepts tokens of the form "dev:phone:+91XXXXXXXXXX"
func devTokenParse(token string) (phone, uid string, err error) {
	if len(token) > 10 && token[:10] == "dev:phone:" {
		p := token[10:]
		return p, "dev-" + p, nil
	}
	return "", "", fmt.Errorf("invalid dev token")
}
