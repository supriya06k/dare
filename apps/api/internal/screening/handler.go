package screening

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/dare-app/api/internal/notify"
	"github.com/dare-app/api/internal/verification"
	"github.com/dare-app/api/internal/ws"
	"github.com/dare-app/api/pkg/apperr"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
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

	// Apply the AI verdict via the verification state machine: high confidence
	// auto-resolves (verified | ai_rejected); otherwise a crowd-vote window opens,
	// closed later by the verification resolver.
	if err := verification.ApplyScreening(r.Context(), h.db, h.hub, h.notify, dropID, req.Pass, req.Confidence); err != nil {
		apperr.Write(w, apperr.New(http.StatusInternalServerError, "screening apply failed"))
		return
	}

	apperr.JSON(w, http.StatusOK, map[string]string{"status": "processed"})
}
