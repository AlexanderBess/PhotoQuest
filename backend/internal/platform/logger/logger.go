// Package logger builds the process logger.
//
// Redaction of sensitive values arrives in PQ-005.
package logger

import (
	"io"
	"log/slog"
)

// New returns a logger writing text in the local environment and JSON elsewhere.
// An unknown level falls back to info; validated configuration arrives in PQ-005.
func New(env, level string, w io.Writer) *slog.Logger {
	var parsed slog.Level
	if err := parsed.UnmarshalText([]byte(level)); err != nil {
		parsed = slog.LevelInfo
	}

	opts := &slog.HandlerOptions{Level: parsed}
	if env == "local" {
		return slog.New(slog.NewTextHandler(w, opts))
	}
	return slog.New(slog.NewJSONHandler(w, opts))
}
