package app

import (
	"context"
	"log/slog"
)

// RunWorker idles until ctx is cancelled: no loop, no polling, no sleep.
// PQ-006 replaces the wait with a time.Ticker-based poll selected together with ctx.Done().
func RunWorker(ctx context.Context, log *slog.Logger) error {
	log.Info("worker ready")
	<-ctx.Done()
	log.Info("worker stopped")
	return nil
}
