package users

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/dare-app/api/pkg/apperr"
	"github.com/dare-app/api/pkg/middleware"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct{ db *pgxpool.Pool }

func NewHandler(db *pgxpool.Pool) *Handler { return &Handler{db: db} }

func (h *Handler) Register(r chi.Router) {
	r.Get("/me", h.Me)
	r.Get("/me/badges", h.Badges)
	r.Patch("/me", h.UpdateProfile)
	r.Post("/me/fcm-token", h.RegisterFCMToken)
}

type Profile struct {
	ID           int64   `json:"id"`
	Handle       string  `json:"handle"`
	Phone        string  `json:"phone"`
	City         string  `json:"city"`
	PlayerNo     string  `json:"playerNo"`
	Rep          int     `json:"rep"`
	Streak       int     `json:"streak"`
	CityRank     int     `json:"cityRank"`
	Completions  int     `json:"completions"`
	Forfeits     int     `json:"forfeits"`
	VotesGiven   int     `json:"votesGiven"`
	Score        int     `json:"score"`
	PoolSharePct float64 `json:"poolSharePct"`
	Badges       []Badge `json:"badges"`
}

type Badge struct {
	Label string `json:"label"`
	Icon  string `json:"icon"`
	Hint  string `json:"hint"`
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())

	var p Profile
	err := h.db.QueryRow(r.Context(), `
		SELECT u.id, COALESCE(u.handle,''), u.phone, COALESCE(u.city,''),
		       COALESCE(u.player_no,''), u.rep, u.streak, u.challenges,
		       u.forfeits, u.votes_given,
		       RANK() OVER (ORDER BY u.rep DESC) as city_rank
		FROM users u WHERE u.id=$1
	`, userID).Scan(&p.ID, &p.Handle, &p.Phone, &p.City,
		&p.PlayerNo, &p.Rep, &p.Streak, &p.Completions,
		&p.Forfeits, &p.VotesGiven, &p.CityRank)
	if err != nil {
		apperr.Write(w, apperr.ErrNotFound)
		return
	}

	p.Score = p.Completions*5 + p.VotesGiven*1
	p.Badges = computeBadges(r.Context(), h.db, userID)

	// pool share — score / total_score × 100
	var totalScore int
	h.db.QueryRow(r.Context(),
		`SELECT COALESCE(SUM(challenges*5 + votes_given),1) FROM users`).Scan(&totalScore)
	if totalScore > 0 {
		p.PoolSharePct = float64(p.Score) / float64(totalScore) * 100
	}

	apperr.JSON(w, http.StatusOK, p)
}

func (h *Handler) Badges(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	badges := computeBadges(r.Context(), h.db, userID)
	apperr.JSON(w, http.StatusOK, badges)
}

func (h *Handler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	// stub — implement when profile edit screen is built
	apperr.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) RegisterFCMToken(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	var req struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Token == "" {
		apperr.Write(w, apperr.ErrBadRequest)
		return
	}
	if _, err := h.db.Exec(r.Context(), `UPDATE users SET fcm_token=$1 WHERE id=$2`, req.Token, userID); err != nil {
		slog.Error("users: register fcm token failed", "user_id", userID, "err", err)
		apperr.Write(w, apperr.New(http.StatusInternalServerError, "db error"))
		return
	}
	apperr.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
