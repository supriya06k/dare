package live

import (
	"net/http"

	"github.com/dare-app/api/internal/ws"
	"github.com/dare-app/api/pkg/apperr"
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
}

type LiveSession struct {
	ID           int64  `json:"id"`
	PlayerNo     string `json:"playerNo"`
	Initials     string `json:"initials"`
	Name         string `json:"name"`
	City         string `json:"city"`
	SeasonRank   int    `json:"seasonRank"`
	Challenge    string `json:"challenge"`
	EndsInSeconds int   `json:"endsInSeconds"`
	Viewers      int    `json:"viewers"`
	PassVotes    int    `json:"passVotes"`
	FailVotes    int    `json:"failVotes"`
	ColorKey     string `json:"colorKey"`
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
