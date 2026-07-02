package live

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/dare-app/api/internal/ws"
	"github.com/dare-app/api/pkg/apperr"
	"github.com/dare-app/api/pkg/middleware"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type Handler struct {
	db  *pgxpool.Pool
	rdb *redis.Client
	hub *ws.Hub
}

func NewHandler(db *pgxpool.Pool, rdb *redis.Client, hub *ws.Hub) *Handler {
	return &Handler{db: db, rdb: rdb, hub: hub}
}

func (h *Handler) Register(r chi.Router) {
	r.Get("/", h.List)
	r.Post("/{id}/vote", h.Vote)
}

type LiveSession struct {
	ID            int64  `json:"id"`
	PlayerNo      string `json:"playerNo"`
	Initials      string `json:"initials"`
	Name          string `json:"name"`
	City          string `json:"city"`
	SeasonRank    int    `json:"seasonRank"`
	Challenge     string `json:"challenge"`
	EndsInSeconds int    `json:"endsInSeconds"`
	Viewers       int    `json:"viewers"`
	PassVotes     int    `json:"passVotes"`
	FailVotes     int    `json:"failVotes"`
	ColorKey      string `json:"colorKey"`
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Query(r.Context(), `
		SELECT id, player_no, initials, name, city, season_rank,
		       challenge, ends_in_seconds, viewers, pass_votes, fail_votes, color_key
		FROM live_sessions
		WHERE ends_in_seconds > 0
		ORDER BY viewers DESC
	`)
	if err != nil {
		apperr.Write(w, apperr.New(500, "db error"))
		return
	}
	defer rows.Close()

	result := []LiveSession{}
	for rows.Next() {
		var s LiveSession
		rows.Scan(&s.ID, &s.PlayerNo, &s.Initials, &s.Name, &s.City,
			&s.SeasonRank, &s.Challenge, &s.EndsInSeconds,
			&s.Viewers, &s.PassVotes, &s.FailVotes, &s.ColorKey)
		result = append(result, s)
	}
	apperr.JSON(w, http.StatusOK, result)
}

type voteReq struct {
	Verdict string `json:"verdict"`
}

// Vote records a crowd vote on a live session. One vote per user per session
// (deduped in Redis — live sessions are ephemeral); the first vote earns Coins.
// The new tally is broadcast to the session's WebSocket room so watchers update live.
func (h *Handler) Vote(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	userID := middleware.UserID(r.Context())

	var req voteReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || (req.Verdict != "pass" && req.Verdict != "fail") {
		apperr.Write(w, apperr.New(http.StatusBadRequest, "verdict must be pass or fail"))
		return
	}

	// Session must exist.
	var exists int
	if err := h.db.QueryRow(r.Context(), `SELECT 1 FROM live_sessions WHERE id=$1`, id).Scan(&exists); err != nil {
		apperr.Write(w, apperr.ErrNotFound)
		return
	}

	// One vote per user per session, deduped in Redis. Dedup is mandatory: without it a
	// user could vote repeatedly and farm Coins, so a missing or unreachable Redis must
	// fail closed (reject the vote) rather than wave every request through.
	if h.rdb == nil {
		slog.Error("live vote rejected: redis unavailable for dedup", "session", id, "user", userID)
		apperr.Write(w, apperr.New(http.StatusServiceUnavailable, "voting temporarily unavailable"))
		return
	}
	voteKey := fmt.Sprintf("livevote:%d:%d", id, userID)
	first, err := h.rdb.SetNX(r.Context(), voteKey, 1, 6*time.Hour).Result()
	if err != nil {
		slog.Error("live vote rejected: redis dedup failed", "session", id, "user", userID, "err", err)
		apperr.Write(w, apperr.New(http.StatusServiceUnavailable, "voting temporarily unavailable"))
		return
	}

	var pass, fail, earned int
	if first {
		col := "pass_votes"
		if req.Verdict == "fail" {
			col = "fail_votes"
		}
		// Tally + coin award + votes_given commit atomically, and the new tally is read
		// back from the same UPDATE so the broadcast reflects a committed count. On failure,
		// release the dedup key so the user can retry — otherwise they'd be locked out with
		// no vote recorded.
		p, f, recErr := h.recordLiveVote(r.Context(), id, userID, col)
		if recErr != nil {
			h.rdb.Del(r.Context(), voteKey)
			apperr.Write(w, apperr.New(http.StatusInternalServerError, "db error"))
			return
		}
		pass, fail, earned = p, f, 3
	} else {
		// Already voted — report the current tally without touching it.
		if err := h.db.QueryRow(r.Context(),
			`SELECT pass_votes, fail_votes FROM live_sessions WHERE id=$1`, id).Scan(&pass, &fail); err != nil {
			apperr.Write(w, apperr.New(http.StatusInternalServerError, "db error"))
			return
		}
	}

	// Broadcast to the session's room (the live screen subscribes to /ws/live/{sessionID}).
	h.hub.Broadcast(strconv.FormatInt(id, 10), "vote_update", ws.VoteUpdate{
		PassVotes: pass, FailVotes: fail, Total: pass + fail,
	})

	apperr.JSON(w, http.StatusOK, map[string]any{
		"passVotes":    pass,
		"failVotes":    fail,
		"alreadyVoted": !first,
		"coinsEarned":  earned,
	})
}

// recordLiveVote applies the tally bump, coin award, and votes_given increment for a
// live vote in a single transaction, returning the updated pass/fail tally read back
// from the same UPDATE so the caller broadcasts a consistent, committed count.
func (h *Handler) recordLiveVote(ctx context.Context, sessionID, userID int64, col string) (pass, fail int, err error) {
	tx, err := h.db.Begin(ctx)
	if err != nil {
		return 0, 0, err
	}
	defer tx.Rollback(ctx)

	if err = tx.QueryRow(ctx, `UPDATE live_sessions SET `+col+`=`+col+`+1 WHERE id=$1
		RETURNING pass_votes, fail_votes`, sessionID).Scan(&pass, &fail); err != nil {
		return 0, 0, err
	}
	if _, err = tx.Exec(ctx, `
		INSERT INTO ledger (user_id, currency, amount, reason, created_at)
		VALUES ($1, 'coins', 3, $2, NOW())`, userID, fmt.Sprintf("live_vote:%d", sessionID)); err != nil {
		return 0, 0, err
	}
	if _, err = tx.Exec(ctx, `UPDATE users SET votes_given=votes_given+1 WHERE id=$1`, userID); err != nil {
		return 0, 0, err
	}
	if err = tx.Commit(ctx); err != nil {
		return 0, 0, err
	}
	return pass, fail, nil
}
