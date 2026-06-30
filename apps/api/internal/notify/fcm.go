package notify

import (
	"context"
	"fmt"
	"log/slog"
	"os"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/messaging"
	"google.golang.org/api/option"
)

// Client wraps the FCM messaging client. When FIREBASE_PROJECT_ID is unset
// (local dev), the underlying messaging client is nil and Send becomes a
// logging no-op. Notification failures must never break the main flow.
type Client struct {
	msg *messaging.Client
}

// NewStub returns a no-op client for use when initialization fails.
func NewStub() *Client { return &Client{} }

// New constructs an FCM client. In local dev (no FIREBASE_PROJECT_ID env var),
// it returns a stub client that logs instead of sending. Returning an error
// is reserved for misconfiguration when a project ID is set but the SDK
// cannot be initialized.
func New(ctx context.Context, projectID string) (*Client, error) {
	if projectID == "" {
		slog.Info("fcm: running in stub mode (no FIREBASE_PROJECT_ID)")
		return &Client{}, nil
	}

	cfg := &firebase.Config{ProjectID: projectID}
	var opts []option.ClientOption
	if cred := os.Getenv("GOOGLE_APPLICATION_CREDENTIALS"); cred != "" {
		opts = append(opts, option.WithCredentialsFile(cred))
	}

	app, err := firebase.NewApp(ctx, cfg, opts...)
	if err != nil {
		return nil, fmt.Errorf("firebase init: %w", err)
	}
	msg, err := app.Messaging(ctx)
	if err != nil {
		return nil, fmt.Errorf("firebase messaging: %w", err)
	}
	return &Client{msg: msg}, nil
}

// Send dispatches a single FCM message. Empty tokens are silently skipped.
// Errors are logged and swallowed — push failures must never propagate to
// the caller's HTTP flow.
func (c *Client) Send(ctx context.Context, token, title, body string, data map[string]string) error {
	if c == nil || token == "" {
		return nil
	}
	if c.msg == nil {
		slog.Info("fcm stub send", "token", token, "title", title, "body", body, "data", data)
		return nil
	}

	_, err := c.msg.Send(ctx, &messaging.Message{
		Token: token,
		Notification: &messaging.Notification{
			Title: title,
			Body:  body,
		},
		Data: data,
	})
	if err != nil {
		slog.Warn("fcm send failed", "err", err, "title", title)
	}
	return nil
}

func (c *Client) DropVerified(ctx context.Context, token, dareTitle string) {
	c.Send(ctx, token,
		"Your dare was verified! 🎯",
		dareTitle,
		map[string]string{"type": "drop_verified", "dareTitle": dareTitle},
	)
}

func (c *Client) DropNeedsVotes(ctx context.Context, token, dareTitle string) {
	c.Send(ctx, token,
		"Vote needed",
		fmt.Sprintf("Vote needed: %s", dareTitle),
		map[string]string{"type": "drop_needs_votes", "dareTitle": dareTitle},
	)
}

func (c *Client) DareAccepted(ctx context.Context, originatorToken, dareTitle, acceptorHandle string) {
	c.Send(ctx, originatorToken,
		"Someone accepted your dare",
		fmt.Sprintf("%s accepted: %s", acceptorHandle, dareTitle),
		map[string]string{
			"type":            "dare_accepted",
			"dareTitle":       dareTitle,
			"acceptorHandle":  acceptorHandle,
		},
	)
}

func (c *Client) PayoutProcessed(ctx context.Context, token string, amountUSD float64) {
	c.Send(ctx, token,
		"Payout on its way 💸",
		fmt.Sprintf("Payout of $%.2f is on its way", amountUSD),
		map[string]string{
			"type":   "payout_processed",
			"amount": fmt.Sprintf("%.2f", amountUSD),
		},
	)
}
