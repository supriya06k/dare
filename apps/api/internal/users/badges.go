package users

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

const aiAutoThreshold = 0.85

func computeBadges(ctx context.Context, db *pgxpool.Pool, userID int64) []Badge {
	all := []Badge{
		{Label: "Speed Demon", Icon: "⚡", Hint: "Complete 3 dares within 5 min of accepting"},
		{Label: "AI Slayer", Icon: "🤖", Hint: "Crowd overrides AI verdict 3× in your favor"},
		{Label: "Human Verified", Icon: "✓", Hint: "5 crowd-verified completions"},
	}

	earned := make(map[string]bool)

	// Speed Demon — 3+ verified drops submitted within 5 min of accepting
	var speedCount int
	db.QueryRow(ctx, `
		SELECT COUNT(*) FROM drops
		WHERE user_id=$1 AND status='verified'
		AND proof_submitted_at IS NOT NULL
		AND deadline_at IS NOT NULL
		AND EXTRACT(EPOCH FROM (deadline_at - proof_submitted_at)) >= (20*60 - 5*60)
	`, userID).Scan(&speedCount)
	if speedCount >= 3 {
		earned["Speed Demon"] = true
	}

	// AI Slayer — crowd overrode AI 3+ times (went to voting AND ended verified)
	var aiSlayerCount int
	db.QueryRow(ctx, `
		SELECT COUNT(*) FROM drops
		WHERE user_id=$1 AND status='verified'
		AND ai_confidence IS NOT NULL AND ai_confidence < $2
	`, userID, aiAutoThreshold).Scan(&aiSlayerCount)
	if aiSlayerCount >= 3 {
		earned["AI Slayer"] = true
	}

	// Human Verified — 5+ crowd-verified completions
	var verifiedCount int
	db.QueryRow(ctx, `
		SELECT COUNT(*) FROM drops WHERE user_id=$1 AND status='verified'
	`, userID).Scan(&verifiedCount)
	if verifiedCount >= 5 {
		earned["Human Verified"] = true
	}

	result := []Badge{}
	for _, b := range all {
		if earned[b.Label] {
			result = append(result, Badge{Label: b.Label, Icon: b.Icon})
		} else {
			result = append(result, b) // include with Hint so frontend can show progress
		}
	}
	return result
}
