// Package proctest runs a command's entry point as a real child process in
// tests, so signal handling can be verified end to end (PQ-004).
//
// The helpers are Unix-only: Windows cannot deliver SIGTERM to a process.
// They run in Linux CI; on Windows this package has no exported API.
package proctest
