package config

import "testing"

// Deliberate failure for the PQ-004 CI proof (branch ci-failure-proof only; never merge).
func TestCIFailureProof(t *testing.T) {
	t.Fatal("deliberate failure: the backend jobs must turn red")
}
