// Package config reads process configuration from the environment.
//
// This is deliberately minimal: validated configuration that fails fast
// arrives in PQ-005.
package config

import (
	"fmt"
	"os"
	"time"
)

const (
	defaultEnv             = "local"
	defaultHTTPAddr        = "127.0.0.1:8080"
	defaultLogLevel        = "info"
	defaultShutdownTimeout = 10 * time.Second // [A] default, tunable through PQ_SHUTDOWN_TIMEOUT
)

// Config holds the settings shared by the API and worker processes.
type Config struct {
	Env             string
	HTTPAddr        string
	LogLevel        string
	ShutdownTimeout time.Duration
}

// Load reads the PQ_* environment variables, applying defaults for unset ones.
func Load() (Config, error) {
	cfg := Config{
		Env:             getenv("PQ_ENV", defaultEnv),
		HTTPAddr:        getenv("PQ_HTTP_ADDR", defaultHTTPAddr),
		LogLevel:        getenv("PQ_LOG_LEVEL", defaultLogLevel),
		ShutdownTimeout: defaultShutdownTimeout,
	}

	if raw := os.Getenv("PQ_SHUTDOWN_TIMEOUT"); raw != "" {
		timeout, err := time.ParseDuration(raw)
		if err != nil {
			return Config{}, fmt.Errorf("parse PQ_SHUTDOWN_TIMEOUT: %w", err)
		}
		cfg.ShutdownTimeout = timeout
	}

	return cfg, nil
}

func getenv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
