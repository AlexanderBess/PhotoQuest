package app

import (
	"context"
	"io"
	"log/slog"
	"net"
	"net/http"
	"testing"
	"time"
)

const testDeadline = 5 * time.Second

func discardLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func listenLocal(t *testing.T) net.Listener {
	t.Helper()
	var listenConfig net.ListenConfig
	listener, err := listenConfig.Listen(context.Background(), "tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	return listener
}

// getStatus returns the response status code, and is safe to call from any goroutine.
func getStatus(ctx context.Context, url string) (int, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return 0, err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return 0, err
	}
	defer func() { _ = resp.Body.Close() }()
	return resp.StatusCode, nil
}

func waitResult(t *testing.T, done <-chan error) error {
	t.Helper()
	select {
	case err := <-done:
		return err
	case <-time.After(testDeadline):
		t.Fatal("serve did not return in time")
		return nil
	}
}

func TestServeAnswersHealthzAndStopsOnCancel(t *testing.T) {
	listener := listenLocal(t)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	done := make(chan error, 1)
	go func() { done <- serve(ctx, listener, newRouter(), testDeadline, discardLogger()) }()

	status, err := getStatus(t.Context(), "http://"+listener.Addr().String()+"/healthz")
	if err != nil {
		t.Fatalf("GET /healthz: %v", err)
	}
	if status != http.StatusOK {
		t.Errorf("status = %d, want %d", status, http.StatusOK)
	}

	cancel()
	if err := waitResult(t, done); err != nil {
		t.Errorf("serve() error = %v, want nil", err)
	}
}

func TestServeFinishesInFlightRequestBeforeExit(t *testing.T) {
	listener := listenLocal(t)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	started := make(chan struct{})
	release := make(chan struct{})
	handler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		close(started)
		<-release
		w.WriteHeader(http.StatusNoContent)
	})

	done := make(chan error, 1)
	go func() { done <- serve(ctx, listener, handler, testDeadline, discardLogger()) }()

	status := make(chan int, 1)
	go func() {
		code, err := getStatus(context.Background(), "http://"+listener.Addr().String()+"/")
		if err != nil {
			t.Errorf("in-flight request: %v", err)
		}
		status <- code
	}()

	<-started
	cancel()
	select {
	case err := <-done:
		t.Fatalf("serve returned before the in-flight request finished: %v", err)
	case <-time.After(50 * time.Millisecond):
	}

	close(release)
	if err := waitResult(t, done); err != nil {
		t.Errorf("serve() error = %v, want nil", err)
	}
	if got := <-status; got != http.StatusNoContent {
		t.Errorf("in-flight status = %d, want %d", got, http.StatusNoContent)
	}
}

func TestServeReportsShutdownTimeout(t *testing.T) {
	listener := listenLocal(t)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	started := make(chan struct{})
	release := make(chan struct{})
	defer close(release)
	handler := http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {
		close(started)
		<-release
	})

	done := make(chan error, 1)
	go func() { done <- serve(ctx, listener, handler, 10*time.Millisecond, discardLogger()) }()

	// The request is abandoned when ctx is cancelled, so its result does not matter.
	go func() { _, _ = getStatus(ctx, "http://"+listener.Addr().String()+"/") }()

	<-started
	cancel()
	if err := waitResult(t, done); err == nil {
		t.Error("serve() error = nil, want a shutdown timeout error")
	}
}

func TestRunAPIReportsListenError(t *testing.T) {
	listener := listenLocal(t)
	defer func() { _ = listener.Close() }()

	cfg := testConfig(listener.Addr().String())
	if err := RunAPI(context.Background(), cfg, discardLogger()); err == nil {
		t.Error("RunAPI() error = nil, want a listen error")
	}
}
