// Command worker runs the PhotoQuest background worker.
package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/AlexanderBess/PhotoQuest/backend/internal/app"
	"github.com/AlexanderBess/PhotoQuest/backend/internal/platform/config"
	"github.com/AlexanderBess/PhotoQuest/backend/internal/platform/logger"
)

func main() {
	os.Exit(run())
}

func run() int {
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintln(os.Stderr, "worker: configuration:", err)
		return 1
	}
	log := logger.New(cfg.Env, cfg.LogLevel, os.Stdout)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := app.RunWorker(ctx, log); err != nil {
		log.Error("worker failed", "error", err)
		return 1
	}
	return 0
}
