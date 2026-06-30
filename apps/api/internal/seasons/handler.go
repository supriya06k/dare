package seasons

import (
	"net/http"

	"github.com/dare-app/api/pkg/apperr"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct{ db *pgxpool.Pool }

func NewHandler(db *pgxpool.Pool) *Handler { return &Handler{db: db} }

func (h *Handler) Register(r chi.Router) {
	r.Get("/current", h.Current)
	r.Get("/current/leaderboard", h.Leaderboard)
}

type SeasonResp struct {
	ID            int64  `json:"id"`
	Number        int    `json:"number"`
	PrizePoolCoins int64 `json:"prizePoolCoins"`
	EndsAt        string `json:"endsAt"`
	DaysLeft      int    `json:"daysLeft"`
}

func (h *Handler) Current(w http.ResponseWriter, r *http.Request) {
	var s SeasonResp
	err := h.db.QueryRow(r.Context(), `
		SELECT id, number, prize_pool_coins, ends_at,
		       GREATEST(0, EXTRACT(DAY FROM (ends_at - NOW()))::int)
		FROM seasons ORDER BY number DESC LIMIT 1
	`).Scan(&s.ID, &s.Number, &s.PrizePoolCoins, &s.EndsAt, &s.DaysLeft)
	if err != nil {
		apperr.Write(w, apperr.ErrNotFound)
		return
	}
	apperr.JSON(w, http.StatusOK, s)
}

type LeaderboardEntry struct {
	Rank   int    `json:"rank"`
	UserID int64  `json:"userId"`
	Handle string `json:"handle"`
	City   string `json:"city"`
	Score  int    `json:"score"`
	Rep    int    `json:"rep"`
}

func (h *Handler) Leaderboard(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Query(r.Context(), `
		SELECT
			RANK() OVER (ORDER BY (challenges*5 + votes_given) DESC) as rank,
			id, COALESCE(handle,''), COALESCE(city,''),
			(challenges*5 + votes_given) as score,
			rep
		FROM users
		ORDER BY score DESC
		LIMIT 50
	`)
	if err != nil {
		apperr.Write(w, apperr.New(500, "db error"))
		return
	}
	defer rows.Close()

	result := []LeaderboardEntry{}
	for rows.Next() {
		var e LeaderboardEntry
		rows.Scan(&e.Rank, &e.UserID, &e.Handle, &e.City, &e.Score, &e.Rep)
		result = append(result, e)
	}
	apperr.JSON(w, http.StatusOK, result)
}
