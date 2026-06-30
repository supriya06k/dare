package dares

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/dare-app/api/internal/notify"
	"github.com/dare-app/api/pkg/apperr"
	"github.com/dare-app/api/pkg/middleware"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type Handler struct {
	db     *pgxpool.Pool
	rdb    *redis.Client
	notify *notify.Client
}

func NewHandler(db *pgxpool.Pool, rdb *redis.Client, notifier *notify.Client) *Handler {
	return &Handler{db: db, rdb: rdb, notify: notifier}
}

func (h *Handler) Register(r chi.Router) {
	r.Get("/", h.List)
	r.Post("/", h.Create)
	r.Post("/check", h.CheckDuplicate)
	r.Get("/{id}", h.Get)
	r.Get("/slug/{slug}", h.GetBySlug)
	r.Post("/{id}/accept", h.Accept)
}

type Dare struct {
	ID              int64   `json:"id"`
	Slug            string  `json:"slug"`
	Title           string  `json:"title"`
	Category        string  `json:"category"`
	Difficulty      string  `json:"difficulty"`
	RepReward       int     `json:"repReward"`
	IsBrandDare     bool    `json:"isBrandDare"`
	OriginatorID    *int64  `json:"originatorId"`
	OriginatorHandle *string `json:"originatorHandle"`
	TotalDrops      int     `json:"totalDrops"`
	TotalVerified   int     `json:"totalVerified"`
	ExpiresInSeconds int    `json:"expiresInSeconds"`
	ColorKey        string  `json:"colorKey"`
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	category := r.URL.Query().Get("category")
	brandOnly := r.URL.Query().Get("brand") == "true"

	query := `
		SELECT d.id, d.slug, d.title, d.category, d.difficulty, d.rep_reward,
		       d.is_brand_dare, d.originator_user_id, u.handle,
		       d.total_drops, d.total_verified, d.color_key,
		       GREATEST(0, EXTRACT(EPOCH FROM (d.expires_at - NOW()))::int) as expires_in_seconds
		FROM dares d
		LEFT JOIN users u ON d.originator_user_id = u.id
		WHERE d.expires_at > NOW()
	`
	args := []any{}
	n := 1
	if category != "" {
		query += ` AND d.category = $` + strconv.Itoa(n)
		args = append(args, category)
		n++
	}
	if brandOnly {
		query += ` AND d.is_brand_dare = TRUE`
	}
	query += ` ORDER BY d.created_at DESC LIMIT 50`

	rows, err := h.db.Query(r.Context(), query, args...)
	if err != nil {
		apperr.Write(w, apperr.New(500, "db error"))
		return
	}
	defer rows.Close()

	result := []Dare{}
	for rows.Next() {
		var d Dare
		if err := rows.Scan(&d.ID, &d.Slug, &d.Title, &d.Category, &d.Difficulty,
			&d.RepReward, &d.IsBrandDare, &d.OriginatorID, &d.OriginatorHandle,
			&d.TotalDrops, &d.TotalVerified, &d.ColorKey, &d.ExpiresInSeconds); err != nil {
			continue
		}
		result = append(result, d)
	}
	apperr.JSON(w, http.StatusOK, result)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	h.getByField(w, r, "d.id", id)
}

func (h *Handler) GetBySlug(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	h.getByField(w, r, "d.slug", slug)
}

func (h *Handler) getByField(w http.ResponseWriter, r *http.Request, field string, val any) {
	var d Dare
	err := h.db.QueryRow(r.Context(), `
		SELECT d.id, d.slug, d.title, d.category, d.difficulty, d.rep_reward,
		       d.is_brand_dare, d.originator_user_id, u.handle,
		       d.total_drops, d.total_verified, d.color_key,
		       GREATEST(0, EXTRACT(EPOCH FROM (d.expires_at - NOW()))::int)
		FROM dares d
		LEFT JOIN users u ON d.originator_user_id = u.id
		WHERE `+field+` = $1`, val).Scan(
		&d.ID, &d.Slug, &d.Title, &d.Category, &d.Difficulty,
		&d.RepReward, &d.IsBrandDare, &d.OriginatorID, &d.OriginatorHandle,
		&d.TotalDrops, &d.TotalVerified, &d.ColorKey, &d.ExpiresInSeconds)
	if err != nil {
		apperr.Write(w, apperr.ErrNotFound)
		return
	}
	apperr.JSON(w, http.StatusOK, d)
}

type createReq struct {
	Title      string `json:"title"`
	Category   string `json:"category"`
	Difficulty string `json:"difficulty"`
	ExpiresIn  int    `json:"expiresInHours"` // hours from now
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	var req createReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apperr.Write(w, apperr.ErrBadRequest)
		return
	}
	if req.Title == "" || req.Category == "" {
		apperr.Write(w, apperr.New(http.StatusBadRequest, "title and category required"))
		return
	}

	slug := slugify(req.Title)
	hours := req.ExpiresIn
	if hours <= 0 {
		hours = 24
	}
	repReward := repForDifficulty(req.Difficulty)
	colorKey := colorKeyFor(req.Category)

	var id int64
	err := h.db.QueryRow(r.Context(), `
		INSERT INTO dares (slug, title, category, difficulty, rep_reward,
		                   color_key, originator_user_id, expires_at, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7, NOW() + ($8 * INTERVAL '1 hour'), NOW())
		ON CONFLICT (slug) DO NOTHING
		RETURNING id
	`, slug, req.Title, req.Category, req.Difficulty, repReward,
		colorKey, userID, hours).Scan(&id)
	if err != nil || id == 0 {
		// slug conflict — return existing
		var existing Dare
		h.db.QueryRow(r.Context(), `SELECT id, slug, title FROM dares WHERE slug=$1`, slug).
			Scan(&existing.ID, &existing.Slug, &existing.Title)
		apperr.JSON(w, http.StatusConflict, existing)
		return
	}
	apperr.JSON(w, http.StatusCreated, map[string]any{"id": id, "slug": slug})
}

type checkReq struct {
	Title string `json:"title"`
}

func (h *Handler) CheckDuplicate(w http.ResponseWriter, r *http.Request) {
	var req checkReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apperr.Write(w, apperr.ErrBadRequest)
		return
	}
	slug := slugify(req.Title)

	// Exact slug match
	var id int64
	var existingSlug, existingTitle string
	err := h.db.QueryRow(r.Context(),
		`SELECT id, slug, title FROM dares WHERE slug=$1`, slug).
		Scan(&id, &existingSlug, &existingTitle)
	if err == nil {
		apperr.JSON(w, http.StatusOK, map[string]any{
			"duplicate": true, "dareId": id,
			"slug": existingSlug, "title": existingTitle,
		})
		return
	}

	// Fuzzy word-overlap check against recent dares
	rows, _ := h.db.Query(r.Context(),
		`SELECT id, slug, title FROM dares ORDER BY created_at DESC LIMIT 200`)
	defer rows.Close()
	inputWords := wordSet(req.Title)
	for rows.Next() {
		var rid int64
		var rslug, rtitle string
		rows.Scan(&rid, &rslug, &rtitle)
		if wordOverlap(inputWords, wordSet(rtitle)) >= 0.60 {
			apperr.JSON(w, http.StatusOK, map[string]any{
				"duplicate": true, "dareId": rid,
				"slug": rslug, "title": rtitle,
			})
			return
		}
	}
	apperr.JSON(w, http.StatusOK, map[string]bool{"duplicate": false})
}

type acceptResp struct {
	DropID     int64  `json:"dropId"`
	Status     string `json:"status"`
	DeadlineAt string `json:"deadlineAt"`
	SecondsLeft int   `json:"secondsLeft"`
}

func (h *Handler) Accept(w http.ResponseWriter, r *http.Request) {
	dareID, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	userID := middleware.UserID(r.Context())

	// Check dare exists and is open
	var dareTitle string
	var originatorID *int64
	err := h.db.QueryRow(r.Context(),
		`SELECT title, originator_user_id FROM dares WHERE id=$1 AND expires_at > NOW()`, dareID).
		Scan(&dareTitle, &originatorID)
	if err != nil {
		apperr.Write(w, apperr.ErrNotFound)
		return
	}

	// Prevent double-accept — check for active drop
	var existing int64
	h.db.QueryRow(r.Context(), `
		SELECT id FROM drops
		WHERE dare_id=$1 AND user_id=$2
		AND status IN ('accepted','voting','pending')
	`, dareID, userID).Scan(&existing)
	if existing > 0 {
		apperr.Write(w, apperr.New(http.StatusConflict, "already accepted"))
		return
	}

	var dropID int64
	var deadlineAt string
	err = h.db.QueryRow(r.Context(), `
		INSERT INTO drops (dare_id, user_id, status, deadline_at, created_at)
		VALUES ($1, $2, 'accepted', NOW() + INTERVAL '20 minutes', NOW())
		RETURNING id, deadline_at
	`, dareID, userID).Scan(&dropID, &deadlineAt)
	if err != nil {
		apperr.Write(w, apperr.New(500, "db error"))
		return
	}

	// Increment dare's total_drops
	h.db.Exec(r.Context(), `UPDATE dares SET total_drops=total_drops+1 WHERE id=$1`, dareID)

	if originatorID != nil && h.notify != nil && *originatorID != userID {
		var originatorToken string
		var acceptorHandle string
		h.db.QueryRow(r.Context(), `SELECT COALESCE(fcm_token,'') FROM users WHERE id=$1`, *originatorID).Scan(&originatorToken)
		h.db.QueryRow(r.Context(), `SELECT COALESCE(handle,'') FROM users WHERE id=$1`, userID).Scan(&acceptorHandle)
		h.notify.DareAccepted(r.Context(), originatorToken, dareTitle, acceptorHandle)
	}

	apperr.JSON(w, http.StatusCreated, acceptResp{
		DropID:      dropID,
		Status:      "accepted",
		DeadlineAt:  deadlineAt,
		SecondsLeft: 20 * 60,
	})
}

// ── helpers ──────────────────────────────────────────────────────────────────

func slugify(s string) string {
	s = strings.ToLower(s)
	var b strings.Builder
	for _, c := range s {
		if c >= 'a' && c <= 'z' || c >= '0' && c <= '9' {
			b.WriteRune(c)
		} else if c == ' ' || c == '-' {
			b.WriteRune('-')
		}
	}
	result := b.String()
	if len(result) > 60 {
		return result[:60]
	}
	return result
}

func wordSet(s string) map[string]bool {
	m := make(map[string]bool)
	for _, w := range strings.Fields(strings.ToLower(s)) {
		m[w] = true
	}
	return m
}

func wordOverlap(a, b map[string]bool) float64 {
	if len(a) == 0 {
		return 0
	}
	matches := 0
	for w := range a {
		if b[w] {
			matches++
		}
	}
	return float64(matches) / float64(len(a))
}

func repForDifficulty(d string) int {
	switch strings.ToLower(d) {
	case "easy":
		return 30
	case "hard":
		return 200
	default:
		return 80
	}
}

func colorKeyFor(category string) string {
	switch strings.ToLower(category) {
	case "physical":
		return "wall"
	case "speed":
		return "door"
	case "creative":
		return "door"
	case "social":
		return "gold"
	default:
		return "teal"
	}
}
