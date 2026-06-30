package screening

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/dare-app/api/internal/notify"
	"github.com/dare-app/api/internal/ws"
	"github.com/dare-app/api/pkg/apperr"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	aiAutoThreshold      = 0.85
	crowdOverrideThreshold = 0.60
	votingWindowSeconds  = 60
)

type Handler struct {
	db     *pgxpool.Pool
	hub    *ws.Hub
	notify *notify.Client
}

func NewHandler(db *pgxpool.Pool, hub *ws.Hub, notifier *notify.Client) *Handler {
	return &Handler{db: db, hub: hub, notify: notifier}
}

func (h *Handler) Register(r chi.Router) {
	// Called only by the AI worker — not exposed to mobile clients
	r.Post("/drops/{id}/screening-result", h.Result)
}

type resultReq struct {
	Pass       bool    `json:"pass"`
	Confidence float64 `json:"confidence"`
	Reason     string  `json:"reason"`
}

func (h *Handler) Result(w http.ResponseWriter, r *http.Request) {
	dropID, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)

	var req resultReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apperr.Write(w, apperr.ErrBadRequest)
		return
	}

	// Fetch drop and dare
	var dareID int64
	var userID *int64
	var repReward int
	var dareTitle string
	err := h.db.QueryRow(r.Context(), `
		SELECT dr.dare_id, dr.user_id, da.rep_reward, da.title
		FROM drops dr JOIN dares da ON dr.dare_id = da.id
		WHERE dr.id=$1
	`, dropID).Scan(&dareID, &userID, &repReward, &dareTitle)
	if err != nil {
		apperr.Write(w, apperr.ErrNotFound)
		return
	}

	h.db.Exec(r.Context(), `UPDATE drops SET ai_confidence=$1 WHERE id=$2`, req.Confidence, dropID)

	dareIDStr := strconv.FormatInt(dareID, 10)

	if req.Confidence >= aiAutoThreshold {
		if req.Pass {
			h.verifyDrop(r, dropID, dareID, userID, repReward, dareIDStr, dareTitle)
		} else {
			h.db.Exec(r.Context(), `UPDATE drops SET status='ai_rejected' WHERE id=$1`, dropID)
			h.hub.Broadcast(dareIDStr, "drop_status", ws.DropStatusUpdate{DropID: dropID, Status: "ai_rejected"})
		}
	} else {
		// Send to crowd vote
		h.db.Exec(r.Context(), `
			UPDATE drops SET status='voting',
			voting_ends_at = NOW() + ($1 * INTERVAL '1 second')
			WHERE id=$2
		`, votingWindowSeconds, dropID)
		h.hub.Broadcast(dareIDStr, "drop_status", ws.DropStatusUpdate{DropID: dropID, Status: "voting"})

		if userID != nil && h.notify != nil {
			var fcmToken string
			h.db.QueryRow(r.Context(), `SELECT COALESCE(fcm_token,'') FROM users WHERE id=$1`, *userID).Scan(&fcmToken)
			h.notify.DropNeedsVotes(r.Context(), fcmToken, dareTitle)
		}
	}

	apperr.JSON(w, http.StatusOK, map[string]string{"status": "processed"})
}

func (h *Handler) verifyDrop(r *http.Request, dropID, dareID int64, userID *int64, repReward int, dareIDStr, dareTitle string) {
	h.db.Exec(r.Context(), `UPDATE drops SET status='verified' WHERE id=$1`, dropID)
	h.db.Exec(r.Context(), `UPDATE dares SET total_verified=total_verified+1 WHERE id=$1`, dareID)

	if userID != nil && repReward > 0 {
		h.db.Exec(r.Context(), `UPDATE users SET rep=rep+$1, challenges=challenges+1 WHERE id=$2`, repReward, *userID)
		h.db.Exec(r.Context(), `
			INSERT INTO ledger (user_id, currency, amount, reason, ref_id, created_at)
			VALUES ($1, 'score', $2, 'verified', $3, NOW())
		`, *userID, repReward, fmt.Sprintf("%d", dropID))
	}
	h.hub.Broadcast(dareIDStr, "drop_status", ws.DropStatusUpdate{DropID: dropID, Status: "verified"})

	if userID != nil && h.notify != nil {
		var fcmToken string
		h.db.QueryRow(r.Context(), `SELECT COALESCE(fcm_token,'') FROM users WHERE id=$1`, *userID).Scan(&fcmToken)
		h.notify.DropVerified(r.Context(), fcmToken, dareTitle)
	}
}
