// Package app wires and runs the API and worker processes.
package app

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"time"

	"github.com/AlexanderBess/PhotoQuest/backend/internal/platform/config"
	"github.com/AlexanderBess/PhotoQuest/backend/internal/platform/observability"
)

// HTTP server timeouts. [A] defaults; revisit when real endpoints exist.
const (
	readHeaderTimeout = 5 * time.Second
	readTimeout       = 15 * time.Second
	writeTimeout      = 30 * time.Second
	idleTimeout       = 60 * time.Second
)

// RunAPI serves HTTP until ctx is cancelled, then shuts down gracefully.
func RunAPI(ctx context.Context, cfg config.Config, log *slog.Logger) error {
	var listenConfig net.ListenConfig
	listener, err := listenConfig.Listen(ctx, "tcp", cfg.HTTPAddr)
	if err != nil {
		return fmt.Errorf("listen on %s: %w", cfg.HTTPAddr, err)
	}
	return serve(ctx, listener, newRouter(), cfg.ShutdownTimeout, log)
}

func newRouter() http.Handler {
	mux := http.NewServeMux()
	observability.RegisterHealth(mux)
	return mux
}

func serve(
	ctx context.Context,
	listener net.Listener,
	handler http.Handler,
	shutdownTimeout time.Duration,
	log *slog.Logger,
) error {
	server := &http.Server{
		Handler:           handler,
		ReadHeaderTimeout: readHeaderTimeout,
		ReadTimeout:       readTimeout,
		WriteTimeout:      writeTimeout,
		IdleTimeout:       idleTimeout,
	}

	serveErr := make(chan error, 1)
	go func() { serveErr <- server.Serve(listener) }()
	log.Info("api listening", "addr", listener.Addr().String())

	select {
	case err := <-serveErr:
		return fmt.Errorf("serve: %w", err)
	case <-ctx.Done():
	}

	log.Info("api shutting down", "timeout", shutdownTimeout.String())
	shutdownCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), shutdownTimeout)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		return errors.Join(fmt.Errorf("shutdown: %w", err), server.Close())
	}
	if err := <-serveErr; !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("serve: %w", err)
	}

	log.Info("api stopped")
	return nil
}
