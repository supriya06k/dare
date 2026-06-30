package cache

import (
	"github.com/redis/go-redis/v9"
)

func Connect(url string) *redis.Client {
	if url == "" {
		url = "redis://localhost:6379"
	}
	opts, err := redis.ParseURL(url)
	if err != nil {
		// fallback defaults
		opts = &redis.Options{Addr: "localhost:6379"}
	}
	return redis.NewClient(opts)
}
