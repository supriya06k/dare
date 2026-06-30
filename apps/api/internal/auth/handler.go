package auth

import (
	"encoding/json"
	"net/http"
	"os"
	"time"

	"github.com/dare-app/api/pkg/apperr"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct{ db *pgxpool.Pool }

func NewHandler(db *pgxpool.Pool) *Handler { return &Handler{db: db} }

// SendOTP — client sends Firebase ID token after phone auth completes on device.
// Firebase SDK on the mobile side handles the actual OTP send/verify flow;
// we just receive the resulting ID token and exchange it for our own JWT.
type sendOTPReq struct {
	FirebaseToken string `json:"firebaseToken"`
}

type verifyOTPReq struct {
	FirebaseToken string `json:"firebaseToken"`
}

type authResp struct {
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expiresAt"`
	UserID    int64     `json:"userId"`
	IsNew     bool      `json:"isNew"`
}

// SendOTP is a no-op stub — Firebase SDK on device handles OTP send.
// Kept for API symmetry; mobile calls this to register intent.
func (h *Handler) SendOTP(w http.ResponseWriter, r *http.Request) {
	var req sendOTPReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apperr.Write(w, apperr.New(http.StatusBadRequest, "invalid body"))
		return
	}
	apperr.JSON(w, http.StatusOK, map[string]string{"status": "otp_sent"})
}

// VerifyOTP — receives Firebase ID token, verifies it with Firebase Admin SDK,
// upserts the user in Postgres, returns our own signed JWT.
func (h *Handler) VerifyOTP(w http.ResponseWriter, r *http.Request) {
	var req verifyOTPReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apperr.Write(w, apperr.New(http.StatusBadRequest, "invalid body"))
		return
	}

	phone, uid, err := verifyFirebaseToken(r.Context(), req.FirebaseToken)
	if err != nil {
		apperr.Write(w, apperr.New(http.StatusUnauthorized, "invalid firebase token"))
		return
	}

	// Upsert user
	var userID int64
	var isNew bool
	err = h.db.QueryRow(r.Context(), `
		INSERT INTO users (firebase_uid, phone, created_at, updated_at)
		VALUES ($1, $2, NOW(), NOW())
		ON CONFLICT (firebase_uid) DO UPDATE SET updated_at = NOW()
		RETURNING id, (xmax = 0) AS is_new
	`, uid, phone).Scan(&userID, &isNew)
	if err != nil {
		apperr.Write(w, apperr.New(http.StatusInternalServerError, "db error"))
		return
	}

	token, exp, err := issueJWT(userID, phone)
	if err != nil {
		apperr.Write(w, apperr.New(http.StatusInternalServerError, "token error"))
		return
	}

	apperr.JSON(w, http.StatusOK, authResp{
		Token:     token,
		ExpiresAt: exp,
		UserID:    userID,
		IsNew:     isNew,
	})
}

func issueJWT(userID int64, phone string) (string, time.Time, error) {
	exp := time.Now().Add(30 * 24 * time.Hour)
	claims := jwt.MapClaims{
		"uid":   userID,
		"phone": phone,
		"exp":   exp.Unix(),
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := t.SignedString([]byte(os.Getenv("JWT_SECRET")))
	return signed, exp, err
}
