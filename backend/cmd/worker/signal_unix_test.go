//go:build unix

package main

import (
	"os"
	"strings"
	"syscall"
	"testing"
	"time"

	"github.com/AlexanderBess/PhotoQuest/backend/internal/testsupport/proctest"
)

// TestMain runs the real worker entry point when the test binary is
// re-executed by proctest.RunUntilSignal.
func TestMain(m *testing.M) {
	if os.Getenv(proctest.ChildEnv) == "1" {
		os.Exit(run())
	}
	os.Exit(m.Run())
}

// The worker must stop gracefully with exit code 0 on SIGTERM (sent by
// `docker stop` and process managers) and on SIGINT (Ctrl+C).
func TestWorkerStopsGracefullyOnSignal(t *testing.T) {
	for _, sig := range []syscall.Signal{syscall.SIGTERM, syscall.SIGINT} {
		t.Run(sig.String(), func(t *testing.T) {
			result := proctest.RunUntilSignal(t, []string{
				"PQ_ENV=local",
				"PQ_LOG_LEVEL=info",
				"PQ_SHUTDOWN_TIMEOUT=5s",
			}, "worker ready", sig, 10*time.Second, 10*time.Second)

			if result.ExitCode != 0 {
				t.Errorf("exit code = %d, want 0; output:\n%s", result.ExitCode, result.Output)
			}
			if !strings.Contains(result.Output, "worker stopped") {
				t.Errorf("output does not contain %q:\n%s", "worker stopped", result.Output)
			}
		})
	}
}
