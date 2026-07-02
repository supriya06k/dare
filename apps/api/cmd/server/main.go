package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/dare-app/api/internal/auth"
	"github.com/dare-app/api/internal/dares"
	"github.com/dare-app/api/internal/drops"
	"github.com/dare-app/api/internal/live"
	"github.com/dare-app/api/internal/notify"
	"github.com/dare-app/api/internal/payouts"
	"github.com/dare-app/api/internal/screening"
	"github.com/dare-app/api/internal/seasons"
	"github.com/dare-app/api/internal/users"
	"github.com/dare-app/api/internal/verification"
	"github.com/dare-app/api/internal/ws"
	"github.com/dare-app/api/pkg/cache"
	"github.com/dare-app/api/pkg/db"
	"github.com/dare-app/api/pkg/middleware"
	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/rs/cors"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	pool, err := db.Connect(os.Getenv("DATABASE_URL"))
	if err != nil {
		slog.Error("db connect failed", "err", err)
		os.Exit(1)
	}
	defer pool.Close()

	rdb := cache.Connect(os.Getenv("REDIS_URL"))
	hub := ws.NewHub()
	go hub.Run()

	notifier, err := notify.New(context.Background(), os.Getenv("FIREBASE_PROJECT_ID"))
	if err != nil {
		slog.Warn("fcm init failed — push notifications disabled", "err", err)
		notifier = notify.NewStub()
	}

	// Resolve crowd-vote windows whose timer has elapsed: verify on quorum + consensus,
	// otherwise crowd-reject. Without this, drops the AI is unsure about stay in 'voting' forever.
	go verification.NewResolver(pool, hub, notifier).Run(context.Background(), 10*time.Second)

	if os.Getenv("FIREBASE_CREDENTIALS_FILE") == "" && os.Getenv("ALLOW_DEV_AUTH") != "true" {
		slog.Warn("auth not configured — all logins will be rejected; set FIREBASE_CREDENTIALS_FILE (or ALLOW_DEV_AUTH=true for local dev)")
	}

	r := chi.NewRouter()
	r.Use(chimw.RealIP)
	r.Use(chimw.Recoverer)
	r.Use(chimw.RequestID)
	r.Use(chimw.Timeout(30 * time.Second))
	r.Use(cors.New(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type"},
		AllowCredentials: true,
	}).Handler)

	// Health
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"status":"ok"}`))
	})

	// Public routes
	r.Post("/api/auth/otp/send", auth.NewHandler(pool).SendOTP)
	r.Post("/api/auth/otp/verify", auth.NewHandler(pool).VerifyOTP)

	// Protected routes
	r.Group(func(r chi.Router) {
		r.Use(middleware.JWT(os.Getenv("JWT_SECRET")))

		r.Route("/api/dares", dares.NewHandler(pool, rdb, notifier).Register)
		r.Route("/api/drops", drops.NewHandler(pool, rdb, hub).Register)
		r.Route("/api/users", users.NewHandler(pool).Register)
		r.Route("/api/seasons", seasons.NewHandler(pool).Register)
		r.Route("/api/live", live.NewHandler(pool, rdb, hub).Register)
		r.Route("/api/payouts", payouts.NewHandler(pool).Register)
	})

	// Internal — worker-only, gated by a shared secret (fails closed if INTERNAL_API_SECRET is unset).
	r.Group(func(r chi.Router) {
		r.Use(middleware.Internal(os.Getenv("INTERNAL_API_SECRET")))
		r.Route("/internal", screening.NewHandler(pool, hub, notifier).Register)
	})

	// WebSocket (auth via query param token)
	r.Get("/ws/live/{dareId}", middleware.WSAuth(os.Getenv("JWT_SECRET"), hub.ServeWS))

	addr := ":" + envOr("PORT", "8080")
	srv := &http.Server{Addr: addr, Handler: r}

	go func() {
		slog.Info("server starting", "addr", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "err", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
	slog.Info("server shut down")
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
