package main

import (
	"log/slog"
	"os"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

func main() {
	dir := envOr("MIGRATIONS_DIR", "../../infra/migrations")
	dsn := envOr("DATABASE_URL", "postgres://dare:dare@localhost:5432/dare?sslmode=disable")

	m, err := migrate.New("file://"+dir, dsn)
	if err != nil {
		slog.Error("migrate init", "err", err)
		os.Exit(1)
	}
	defer m.Close()

	cmd := "up"
	if len(os.Args) > 1 {
		cmd = os.Args[1]
	}

	switch cmd {
	case "up":
		if err := m.Up(); err != nil && err != migrate.ErrNoChange {
			slog.Error("migrate up", "err", err)
			os.Exit(1)
		}
		slog.Info("migrations applied")
	case "down":
		if err := m.Down(); err != nil && err != migrate.ErrNoChange {
			slog.Error("migrate down", "err", err)
			os.Exit(1)
		}
		slog.Info("migrations rolled back")
	default:
		slog.Error("unknown command", "cmd", cmd)
		os.Exit(1)
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
