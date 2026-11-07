// Command api runs the PhotoQuest HTTP API.
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
		fmt.Fprintln(os.Stderr, "api: configuration:", err)
		return 1
	}
	log := logger.New(cfg.Env, cfg.LogLevel, os.Stdout)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := app.RunAPI(ctx, cfg, log); err != nil {
		log.Error("api failed", "error", err)
		return 1
	}
	return 0
}
