package drops

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/dare-app/api/internal/ws"
	"github.com/dare-app/api/pkg/apperr"
	"github.com/dare-app/api/pkg/middleware"
	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
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
	r.Get("/mine", h.Mine)
	r.Get("/{id}", h.Get)
	r.Post("/{id}/proof/upload-url", h.GetUploadURL)
	r.Post("/{id}/proof", h.SubmitProof)
	r.Post("/{id}/vote", h.Vote)
}

type Drop struct {
	DropID       int64   `json:"dropId"`
	DareID       int64   `json:"dareId"`
	Slug         string  `json:"slug"`
	Title        string  `json:"title"`
	Category     string  `json:"category"`
	Difficulty   string  `json:"difficulty"`
	RepReward    int     `json:"repReward"`
	Status       string  `json:"status"`
	ProofURL     *string `json:"proofUrl"`
	AIConfidence *float64 `json:"aiConfidence"`
	PassVotes    int     `json:"passVotes"`
	FailVotes    int     `json:"failVotes"`
	DeadlineAt   *string `json:"deadlineAt"`
	SecondsLeft  int     `json:"secondsLeft"`
	CreatedAt    string  `json:"createdAt"`
	ColorKey     string  `json:"colorKey"`
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Query(r.Context(), `
		SELECT dr.id, dr.dare_id, da.slug, da.title, da.category, da.difficulty,
		       da.rep_reward, dr.status, dr.proof_url, dr.ai_confidence,
		       dr.pass_votes, dr.fail_votes, da.color_key, dr.created_at
		FROM drops dr
		JOIN dares da ON dr.dare_id = da.id
		WHERE dr.status = 'verified'
		ORDER BY dr.created_at DESC LIMIT 50
	`)
	if err != nil {
		apperr.Write(w, apperr.New(500, "db error"))
		return
	}
	defer rows.Close()
	result := scanDrops(rows)
	apperr.JSON(w, http.StatusOK, result)
}

func (h *Handler) Mine(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	now := time.Now()

	// Lazy-forfeit overdue accepted drops
	h.db.Exec(r.Context(), `
		UPDATE drops SET status='forfeited'
		WHERE user_id=$1 AND status='accepted'
		AND deadline_at IS NOT NULL AND deadline_at < $2
	`, userID, now)

	rows, err := h.db.Query(r.Context(), `
		SELECT dr.id, dr.dare_id, da.slug, da.title, da.category, da.difficulty,
		       da.rep_reward, dr.status, dr.proof_url, dr.ai_confidence,
		       dr.pass_votes, dr.fail_votes, da.color_key, dr.created_at,
		       dr.deadline_at,
		       GREATEST(0, EXTRACT(EPOCH FROM (dr.deadline_at - NOW()))::int)
		FROM drops dr
		JOIN dares da ON dr.dare_id = da.id
		WHERE dr.user_id = $1
		AND dr.status IN ('accepted','voting','pending','verified','rejected','crowd_rejected','ai_rejected','forfeited')
		ORDER BY dr.created_at DESC LIMIT 40
	`, userID)
	if err != nil {
		apperr.Write(w, apperr.New(500, "db error"))
		return
	}
	defer rows.Close()

	type MineRow struct {
		Drop
		DeadlineAt  *string `json:"deadlineAt"`
		SecondsLeft int     `json:"secondsLeft"`
	}
	result := []MineRow{}
	for rows.Next() {
		var d MineRow
		rows.Scan(&d.DropID, &d.DareID, &d.Slug, &d.Title, &d.Category, &d.Difficulty,
			&d.RepReward, &d.Status, &d.ProofURL, &d.AIConfidence,
			&d.PassVotes, &d.FailVotes, &d.ColorKey, &d.CreatedAt,
			&d.DeadlineAt, &d.SecondsLeft)
		result = append(result, d)
	}
	apperr.JSON(w, http.StatusOK, result)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	var d Drop
	err := h.db.QueryRow(r.Context(), `
		SELECT dr.id, dr.dare_id, da.slug, da.title, da.category, da.difficulty,
		       da.rep_reward, dr.status, dr.proof_url, dr.ai_confidence,
		       dr.pass_votes, dr.fail_votes, da.color_key, dr.created_at
		FROM drops dr
		JOIN dares da ON dr.dare_id = da.id
		WHERE dr.id = $1
	`, id).Scan(&d.DropID, &d.DareID, &d.Slug, &d.Title, &d.Category, &d.Difficulty,
		&d.RepReward, &d.Status, &d.ProofURL, &d.AIConfidence,
		&d.PassVotes, &d.FailVotes, &d.ColorKey, &d.CreatedAt)
	if err != nil {
		apperr.Write(w, apperr.ErrNotFound)
		return
	}
	apperr.JSON(w, http.StatusOK, d)
}

type uploadURLResp struct {
	UploadURL string `json:"uploadUrl"`
	R2Key     string `json:"r2Key"`
	ExpiresIn int    `json:"expiresIn"`
}

func (h *Handler) GetUploadURL(w http.ResponseWriter, r *http.Request) {
	dropID := chi.URLParam(r, "id")
	userID := middleware.UserID(r.Context())

	r2Key := fmt.Sprintf("proofs/%d/%s/%d.mp4", userID, dropID, time.Now().UnixNano())

	cfg, err := awsconfig.LoadDefaultConfig(context.Background(),
		awsconfig.WithRegion("auto"),
	)
	if err != nil {
		apperr.Write(w, apperr.New(500, "storage config error"))
		return
	}

	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(os.Getenv("R2_ENDPOINT"))
	})

	presigner := s3.NewPresignClient(client)
	req, err := presigner.PresignPutObject(context.Background(), &s3.PutObjectInput{
		Bucket:      aws.String(os.Getenv("R2_BUCKET")),
		Key:         aws.String(r2Key),
		ContentType: aws.String("video/mp4"),
	}, s3.WithPresignExpires(10*time.Minute))
	if err != nil {
		apperr.Write(w, apperr.New(500, "presign error"))
		return
	}

	apperr.JSON(w, http.StatusOK, uploadURLResp{
		UploadURL: req.URL,
		R2Key:     r2Key,
		ExpiresIn: 600,
	})
}

type proofReq struct {
	R2Key    string `json:"r2Key"`
	ProofURL string `json:"proofUrl"` // fallback for link-based proof
}

func (h *Handler) SubmitProof(w http.ResponseWriter, r *http.Request) {
	dropID, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	userID := middleware.UserID(r.Context())
	now := time.Now()

	var req proofReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apperr.Write(w, apperr.ErrBadRequest)
		return
	}

	// Verify drop belongs to user and is in accepted state
	var dareID int64
	var dareTitle, dareCategory string
	var deadlineAt *time.Time
	err := h.db.QueryRow(r.Context(), `
		SELECT dr.dare_id, da.title, da.category, dr.deadline_at
		FROM drops dr JOIN dares da ON dr.dare_id = da.id
		WHERE dr.id=$1 AND dr.user_id=$2 AND dr.status='accepted'
	`, dropID, userID).Scan(&dareID, &dareTitle, &dareCategory, &deadlineAt)
	if err != nil {
		apperr.Write(w, apperr.New(http.StatusBadRequest, "drop not found or not in accepted state"))
		return
	}

	if deadlineAt != nil && now.After(*deadlineAt) {
		h.db.Exec(r.Context(), `UPDATE drops SET status='forfeited' WHERE id=$1`, dropID)
		apperr.Write(w, apperr.New(http.StatusGone, "deadline passed"))
		return
	}

	proofURL := req.R2Key
	if proofURL == "" {
		proofURL = req.ProofURL
	}
	if proofURL == "" {
		proofURL = "claim://self"
	}

	_, err = h.db.Exec(r.Context(), `
		UPDATE drops SET proof_url=$1, proof_submitted_at=NOW() WHERE id=$2
	`, proofURL, dropID)
	if err != nil {
		apperr.Write(w, apperr.New(500, "db error"))
		return
	}

	// Queue AI screening job in Redis
	job, _ := json.Marshal(map[string]any{
		"dropId":    dropID,
		"dareTitle": dareTitle,
		"category":  dareCategory,
		"r2Key":     req.R2Key,
		"proofUrl":  proofURL,
	})
	h.rdb.RPush(r.Context(), "queue:screening", job)

	// Optimistically move to pending while AI processes
	h.db.Exec(r.Context(), `UPDATE drops SET status='pending' WHERE id=$1`, dropID)

	apperr.JSON(w, http.StatusOK, map[string]any{
		"dropId": dropID,
		"status": "pending",
	})
}

type voteReq struct {
	Verdict string `json:"verdict"` // "pass" | "fail"
}

func (h *Handler) Vote(w http.ResponseWriter, r *http.Request) {
	dropID, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	userID := middleware.UserID(r.Context())

	var req voteReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || (req.Verdict != "pass" && req.Verdict != "fail") {
		apperr.Write(w, apperr.New(http.StatusBadRequest, "verdict must be pass or fail"))
		return
	}

	// Verify drop is in voting state and not authored by the voter.
	var dareID int64
	var authorID *int64
	err := h.db.QueryRow(r.Context(),
		`SELECT dare_id, user_id FROM drops WHERE id=$1 AND status='voting'`, dropID).Scan(&dareID, &authorID)
	if err != nil {
		apperr.Write(w, apperr.ErrNotFound)
		return
	}
	if authorID != nil && *authorID == userID {
		apperr.Write(w, apperr.New(http.StatusForbidden, "cannot vote on your own drop"))
		return
	}

	// Insert vote — unique constraint prevents double-voting
	_, err = h.db.Exec(r.Context(), `
		INSERT INTO votes (drop_id, voter_user_id, verdict, created_at)
		VALUES ($1, $2, $3, NOW())
	`, dropID, userID, req.Verdict)
	if err != nil {
		apperr.Write(w, apperr.New(http.StatusConflict, "already voted"))
		return
	}

	// Update vote counters
	col := "pass_votes"
	if req.Verdict == "fail" {
		col = "fail_votes"
	}
	h.db.Exec(r.Context(), `UPDATE drops SET `+col+`=`+col+`+1 WHERE id=$1`, dropID)

	// Award coins to voter
	h.db.Exec(r.Context(), `
		INSERT INTO ledger (user_id, currency, amount, reason, created_at)
		VALUES ($1, 'coins', 3, $2, NOW())
	`, userID, fmt.Sprintf("vote:%d", dropID))
	h.db.Exec(r.Context(), `UPDATE users SET votes_given=votes_given+1 WHERE id=$1`, userID)

	// Fetch updated counts and broadcast
	var pass, fail int
	h.db.QueryRow(r.Context(),
		`SELECT pass_votes, fail_votes FROM drops WHERE id=$1`, dropID).Scan(&pass, &fail)

	dareIDStr := strconv.FormatInt(dareID, 10)
	h.hub.Broadcast(dareIDStr, "vote_update", ws.VoteUpdate{
		PassVotes: pass, FailVotes: fail, Total: pass + fail,
	})

	apperr.JSON(w, http.StatusOK, map[string]any{
		"passVotes": pass, "failVotes": fail,
		"coinsEarned": 3,
	})
}

func scanDrops(rows interface {
	Next() bool
	Scan(...any) error
}) []Drop {
	result := []Drop{}
	for rows.Next() {
		var d Drop
		rows.Scan(&d.DropID, &d.DareID, &d.Slug, &d.Title, &d.Category, &d.Difficulty,
			&d.RepReward, &d.Status, &d.ProofURL, &d.AIConfidence,
			&d.PassVotes, &d.FailVotes, &d.ColorKey, &d.CreatedAt)
		result = append(result, d)
	}
	return result
}
