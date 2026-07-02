package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/golang-jwt/jwt/v5"
)

// TestInternal verifies the worker-only gate fails closed: it rejects unless the
// X-Internal-Token header exactly matches a non-empty configured secret.
func TestInternal(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })

	cases := []struct {
		name      string
		secret    string
		header    string
		setHeader bool
		want      int
	}{
		{"empty secret fails closed", "", "anything", true, http.StatusUnauthorized},
		{"empty secret, no header", "", "", false, http.StatusUnauthorized},
		{"wrong token", "s3cret", "nope", true, http.StatusUnauthorized},
		{"missing token", "s3cret", "", false, http.StatusUnauthorized},
		{"correct token", "s3cret", "s3cret", true, http.StatusOK},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/internal/x", nil)
			if c.setHeader {
				req.Header.Set("X-Internal-Token", c.header)
			}
			rr := httptest.NewRecorder()
			Internal(c.secret)(next).ServeHTTP(rr, req)
			if rr.Code != c.want {
				t.Fatalf("status=%d want %d", rr.Code, c.want)
			}
		})
	}
}

func signHS256(t *testing.T, secret string, claims jwt.Claims) string {
	t.Helper()
	s, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	return s
}

// TestWSAuth verifies the WebSocket auth gate: only a valid HMAC token authenticates
// and propagates the user id; an alg-"none" token, garbage, or a missing token are rejected.
func TestWSAuth(t *testing.T) {
	const secret = "test-secret-key-at-least-32-chars!!"

	valid := signHS256(t, secret, &Claims{UserID: 7})
	noneTok, err := jwt.NewWithClaims(jwt.SigningMethodNone, &Claims{UserID: 7}).
		SignedString(jwt.UnsafeAllowNoneSignatureType)
	if err != nil {
		t.Fatalf("sign none: %v", err)
	}

	cases := []struct {
		name  string
		token string
		want  int
	}{
		{"valid HS256", valid, http.StatusOK},
		{"alg none rejected", noneTok, http.StatusUnauthorized},
		{"garbage", "not.a.jwt", http.StatusUnauthorized},
		{"missing", "", http.StatusUnauthorized},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			called := false
			handler := WSAuth(secret, func(w http.ResponseWriter, r *http.Request) {
				called = true
				if got := UserID(r.Context()); got != 7 {
					t.Errorf("UserID=%d want 7", got)
				}
				w.WriteHeader(http.StatusOK)
			})
			url := "/ws/live/1"
			if c.token != "" {
				url += "?token=" + c.token
			}
			rr := httptest.NewRecorder()
			handler(rr, httptest.NewRequest(http.MethodGet, url, nil))
			if rr.Code != c.want {
				t.Fatalf("status=%d want %d", rr.Code, c.want)
			}
			if called != (c.want == http.StatusOK) {
				t.Fatalf("next called=%v but status=%d", called, rr.Code)
			}
		})
	}
}
