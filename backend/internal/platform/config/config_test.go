package config

import (
	"testing"
	"time"
)

func TestLoadDefaults(t *testing.T) {
	for _, key := range []string{"PQ_ENV", "PQ_HTTP_ADDR", "PQ_LOG_LEVEL", "PQ_SHUTDOWN_TIMEOUT"} {
		t.Setenv(key, "")
	}

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	want := Config{
		Env:             "local",
		HTTPAddr:        "127.0.0.1:8080",
		LogLevel:        "info",
		ShutdownTimeout: 10 * time.Second,
	}
	if cfg != want {
		t.Errorf("Load() = %+v, want %+v", cfg, want)
	}
}

func TestLoadReadsEnvironment(t *testing.T) {
	t.Setenv("PQ_ENV", "staging")
	t.Setenv("PQ_HTTP_ADDR", "0.0.0.0:9000")
	t.Setenv("PQ_LOG_LEVEL", "debug")
	t.Setenv("PQ_SHUTDOWN_TIMEOUT", "3s")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	want := Config{
		Env:             "staging",
		HTTPAddr:        "0.0.0.0:9000",
		LogLevel:        "debug",
		ShutdownTimeout: 3 * time.Second,
	}
	if cfg != want {
		t.Errorf("Load() = %+v, want %+v", cfg, want)
	}
}

func TestLoadRejectsInvalidShutdownTimeout(t *testing.T) {
	t.Setenv("PQ_SHUTDOWN_TIMEOUT", "soon")

	if _, err := Load(); err == nil {
		t.Fatal("Load() error = nil, want a parse error")
	}
}
