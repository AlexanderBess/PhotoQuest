//go:build unix

package proctest

import (
	"bufio"
	"errors"
	"os"
	"os/exec"
	"strings"
	"sync"
	"syscall"
	"testing"
	"time"
)

// ChildEnv marks the re-executed test binary. A command package's TestMain
// runs the real entry point instead of the tests when it is set to "1".
const ChildEnv = "PQ_PROCTEST_CHILD"

// Result is the outcome of a child process stopped by a signal.
type Result struct {
	ExitCode int
	Output   string
}

// RunUntilSignal starts the current test binary as a child process running
// the command's entry point, waits until its output contains readyLine,
// sends sig and waits for the process to exit.
//
// env adds or overrides environment variables of the child. The test fails
// if the child is not ready within readyTimeout or does not exit within
// exitTimeout after the signal.
func RunUntilSignal(
	t *testing.T,
	env []string,
	readyLine string,
	sig syscall.Signal,
	readyTimeout, exitTimeout time.Duration,
) Result {
	t.Helper()

	// The child is this test binary itself (os.Args[0]), not external input.
	cmd := exec.CommandContext(t.Context(), os.Args[0], "-test.run=^$") //nolint:gosec // re-executes the test binary
	cmd.Env = append(append(os.Environ(), env...), ChildEnv+"=1")

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		t.Fatalf("stdout pipe: %v", err)
	}
	cmd.Stderr = cmd.Stdout // configuration errors are written to stderr
	if err := cmd.Start(); err != nil {
		t.Fatalf("start child: %v", err)
	}

	var (
		mu     sync.Mutex
		output strings.Builder
	)
	ready := make(chan struct{})
	readDone := make(chan struct{})
	go func() {
		defer close(readDone)
		signalled := false
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := scanner.Text()
			mu.Lock()
			output.WriteString(line)
			output.WriteString("\n")
			mu.Unlock()
			if !signalled && strings.Contains(line, readyLine) {
				signalled = true
				close(ready)
			}
		}
	}()

	collected := func() string {
		mu.Lock()
		defer mu.Unlock()
		return output.String()
	}

	select {
	case <-ready:
	case <-readDone:
		_ = cmd.Wait()
		t.Fatalf("child exited before %q; output:\n%s", readyLine, collected())
	case <-time.After(readyTimeout):
		_ = cmd.Process.Kill()
		_ = cmd.Wait()
		t.Fatalf("child not ready within %s; output:\n%s", readyTimeout, collected())
	}

	if err := cmd.Process.Signal(sig); err != nil {
		t.Fatalf("send %v: %v", sig, err)
	}

	exited := make(chan error, 1)
	go func() {
		<-readDone
		exited <- cmd.Wait()
	}()
	select {
	case err := <-exited:
		// A non-zero exit is reported through Result.ExitCode, not as a failure here.
		var exitErr *exec.ExitError
		if err != nil && !errors.As(err, &exitErr) {
			t.Fatalf("wait for child: %v", err)
		}
	case <-time.After(exitTimeout):
		_ = cmd.Process.Kill()
		t.Logf("child killed: %v", <-exited)
		t.Fatalf("child did not exit within %s after %v; output:\n%s", exitTimeout, sig, collected())
	}

	return Result{ExitCode: cmd.ProcessState.ExitCode(), Output: collected()}
}
