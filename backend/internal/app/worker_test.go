package app

import (
	"context"
	"testing"
	"time"

	"github.com/AlexanderBess/PhotoQuest/backend/internal/platform/config"
)

func testConfig(addr string) config.Config {
	return config.Config{HTTPAddr: addr, ShutdownTimeout: testDeadline}
}

func TestRunWorkerBlocksUntilCancelled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	done := make(chan error, 1)
	go func() { done <- RunWorker(ctx, discardLogger()) }()

	select {
	case err := <-done:
		t.Fatalf("RunWorker returned before cancellation: %v", err)
	case <-time.After(50 * time.Millisecond):
	}

	cancel()
	select {
	case err := <-done:
		if err != nil {
			t.Errorf("RunWorker() error = %v, want nil", err)
		}
	case <-time.After(testDeadline):
		t.Fatal("RunWorker did not return promptly after cancellation")
	}
}
