// Package verification centralizes the drop verification state machine:
// the AI pre-screen verdict, the crowd-vote window, and the resolver that
// closes due windows. Both the screening callback and the background resolver
// drive transitions through this one place.
package verification

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/dare-app/api/internal/notify"
	"github.com/dare-app/api/internal/ws"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	// AiAutoThreshold: AI confidence at/above this auto-resolves the drop (verified | ai_rejected).
	AiAutoThreshold = 0.85
	// CrowdOverrideThreshold: PASS share at/above this verifies a drop via the crowd.
	CrowdOverrideThreshold = 0.60
	// VotingWindowSeconds: how long a crowd-vote window stays open.
	VotingWindowSeconds = 60
	// QuorumMinVotes: minimum crowd votes required before a window can resolve to verified.
	// Below quorum at expiry the drop is crowd-rejected (no consensus).
	QuorumMinVotes = 3
)

// ApplyScreening turns an AI verdict into a drop transition: confidence at/above
// AiAutoThreshold auto-resolves (verified | ai_rejected); otherwise a crowd-vote
// window opens, to be closed later by the resolver.
func ApplyScreening(ctx context.Context, db *pgxpool.Pool, hub *ws.Hub, notifier *notify.Client, dropID int64, pass bool, confidence float64) error {
	if _, err := db.Exec(ctx, `UPDATE drops SET ai_confidence=$1 WHERE id=$2`, confidence, dropID); err != nil {
		return err
	}
	if confidence >= AiAutoThreshold {
		if pass {
			return Verify(ctx, db, hub, notifier, dropID)
		}
		return transition(ctx, db, hub, dropID, "ai_rejected")
	}
	return openVoting(ctx, db, hub, notifier, dropID)
}

// openVoting moves a drop into the crowd-vote window and notifies its author.
func openVoting(ctx context.Context, db *pgxpool.Pool, hub *ws.Hub, notifier *notify.Client, dropID int64) error {
	if _, err := db.Exec(ctx, `
		UPDATE drops SET status='voting',
		       voting_ends_at = NOW() + ($1 * INTERVAL '1 second')
		WHERE id=$2`, VotingWindowSeconds, dropID); err != nil {
		return err
	}
	d, err := load(ctx, db, dropID)
	if err != nil {
		return err
	}
	hub.Broadcast(roomOf(d.dareID), "drop_status", ws.DropStatusUpdate{DropID: dropID, Status: "voting"})
	if d.userID != nil && notifier != nil {
		notifyToken(ctx, db, *d.userID, func(tok string) { notifier.DropNeedsVotes(ctx, tok, d.dareTitle) })
	}
	return nil
}

// verifiedByCrowd reports whether a closed window's tally verifies the drop:
// quorum met AND PASS share at/above the override threshold. Pure for testability.
func verifiedByCrowd(pass, fail int) bool {
	total := pass + fail
	if total < QuorumMinVotes {
		return false
	}
	return float64(pass)/float64(total) >= CrowdOverrideThreshold
}

// ResolveDue closes every crowd-vote window whose timer has elapsed.
func ResolveDue(ctx context.Context, db *pgxpool.Pool, hub *ws.Hub, notifier *notify.Client, now time.Time) error {
	rows, err := db.Query(ctx, `
		SELECT id, pass_votes, fail_votes
		FROM drops
		WHERE status='voting' AND voting_ends_at IS NOT NULL AND voting_ends_at <= $1`, now)
	if err != nil {
		return err
	}
	type due struct {
		id         int64
		pass, fail int
	}
	var dues []due
	for rows.Next() {
		var d due
		if err := rows.Scan(&d.id, &d.pass, &d.fail); err != nil {
			rows.Close()
			return err
		}
		dues = append(dues, d)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}

	for _, d := range dues {
		if verifiedByCrowd(d.pass, d.fail) {
			if err := Verify(ctx, db, hub, notifier, d.id); err != nil {
				slog.Warn("resolve: verify failed", "drop", d.id, "err", err)
			}
		} else if err := transition(ctx, db, hub, d.id, "crowd_rejected"); err != nil {
			slog.Warn("resolve: reject failed", "drop", d.id, "err", err)
		}
	}
	return nil
}

// Verify marks a drop verified, awards rep + a score ledger entry, bumps the
// dare's verified count, broadcasts the transition, and notifies the author.
func Verify(ctx context.Context, db *pgxpool.Pool, hub *ws.Hub, notifier *notify.Client, dropID int64) error {
	d, err := load(ctx, db, dropID)
	if err != nil {
		return err
	}
	if _, err := db.Exec(ctx, `UPDATE drops SET status='verified' WHERE id=$1`, dropID); err != nil {
		return err
	}
	if _, err := db.Exec(ctx, `UPDATE dares SET total_verified=total_verified+1 WHERE id=$1`, d.dareID); err != nil {
		return err
	}
	if d.userID != nil && d.repReward > 0 {
		if _, err := db.Exec(ctx, `UPDATE users SET rep=rep+$1, challenges=challenges+1 WHERE id=$2`, d.repReward, *d.userID); err != nil {
			return err
		}
		if _, err := db.Exec(ctx, `
			INSERT INTO ledger (user_id, currency, amount, reason, ref_id, created_at)
			VALUES ($1, 'score', $2, 'verified', $3, NOW())`, *d.userID, d.repReward, fmt.Sprintf("%d", dropID)); err != nil {
			return err
		}
	}
	hub.Broadcast(roomOf(d.dareID), "drop_status", ws.DropStatusUpdate{DropID: dropID, Status: "verified"})
	if d.userID != nil && notifier != nil {
		notifyToken(ctx, db, *d.userID, func(tok string) { notifier.DropVerified(ctx, tok, d.dareTitle) })
	}
	return nil
}

// transition sets a terminal status and broadcasts it.
func transition(ctx context.Context, db *pgxpool.Pool, hub *ws.Hub, dropID int64, status string) error {
	if _, err := db.Exec(ctx, `UPDATE drops SET status=$1 WHERE id=$2`, status, dropID); err != nil {
		return err
	}
	if dareID, err := dareIDOf(ctx, db, dropID); err == nil {
		hub.Broadcast(roomOf(dareID), "drop_status", ws.DropStatusUpdate{DropID: dropID, Status: status})
	}
	return nil
}

// Resolver periodically closes due crowd-vote windows.
type Resolver struct {
	db       *pgxpool.Pool
	hub      *ws.Hub
	notifier *notify.Client
}

func NewResolver(db *pgxpool.Pool, hub *ws.Hub, notifier *notify.Client) *Resolver {
	return &Resolver{db: db, hub: hub, notifier: notifier}
}

// Run sweeps for due windows every interval until ctx is cancelled.
func (r *Resolver) Run(ctx context.Context, interval time.Duration) {
	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			if err := ResolveDue(ctx, r.db, r.hub, r.notifier, time.Now()); err != nil {
				slog.Warn("resolver sweep failed", "err", err)
			}
		}
	}
}

type dropRow struct {
	dareID    int64
	userID    *int64
	repReward int
	dareTitle string
}

func load(ctx context.Context, db *pgxpool.Pool, dropID int64) (dropRow, error) {
	var d dropRow
	err := db.QueryRow(ctx, `
		SELECT dr.dare_id, dr.user_id, da.rep_reward, da.title
		FROM drops dr JOIN dares da ON dr.dare_id = da.id
		WHERE dr.id=$1`, dropID).Scan(&d.dareID, &d.userID, &d.repReward, &d.dareTitle)
	return d, err
}

func dareIDOf(ctx context.Context, db *pgxpool.Pool, dropID int64) (int64, error) {
	var dareID int64
	err := db.QueryRow(ctx, `SELECT dare_id FROM drops WHERE id=$1`, dropID).Scan(&dareID)
	return dareID, err
}

func notifyToken(ctx context.Context, db *pgxpool.Pool, userID int64, send func(token string)) {
	var token string
	if err := db.QueryRow(ctx, `SELECT COALESCE(fcm_token,'') FROM users WHERE id=$1`, userID).Scan(&token); err != nil {
		return
	}
	send(token)
}

func roomOf(dareID int64) string { return fmt.Sprintf("%d", dareID) }
