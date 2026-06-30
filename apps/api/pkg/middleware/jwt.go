package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/dare-app/api/pkg/apperr"
	"github.com/golang-jwt/jwt/v5"
)

type ctxKey string

const ClaimsKey ctxKey = "claims"

type Claims struct {
	UserID int64  `json:"uid"`
	Phone  string `json:"phone"`
	jwt.RegisteredClaims
}

func JWT(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			raw := r.Header.Get("Authorization")
			if !strings.HasPrefix(raw, "Bearer ") {
				apperr.Write(w, apperr.ErrUnauthorized)
				return
			}
			tokenStr := strings.TrimPrefix(raw, "Bearer ")
			claims := &Claims{}
			_, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (any, error) {
				if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, apperr.ErrUnauthorized
				}
				return []byte(secret), nil
			})
			if err != nil {
				apperr.Write(w, apperr.ErrUnauthorized)
				return
			}
			next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), ClaimsKey, claims)))
		})
	}
}

func WSAuth(secret string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tokenStr := r.URL.Query().Get("token")
		if tokenStr == "" {
			apperr.Write(w, apperr.ErrUnauthorized)
			return
		}
		claims := &Claims{}
		_, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (any, error) {
			return []byte(secret), nil
		})
		if err != nil {
			apperr.Write(w, apperr.ErrUnauthorized)
			return
		}
		next(w, r.WithContext(context.WithValue(r.Context(), ClaimsKey, claims)))
	}
}

func UserID(ctx context.Context) int64 {
	c, ok := ctx.Value(ClaimsKey).(*Claims)
	if !ok {
		return 0
	}
	return c.UserID
}
