// Package observability serves infrastructure probes.
package observability

import "net/http"

var healthyBody = []byte(`{"status":"ok"}`)

// RegisterHealth adds the root-level liveness probe to mux. /readyz arrives in PQ-005.
// The GET pattern makes the mux answer other methods (except HEAD) with 405.
func RegisterHealth(mux *http.ServeMux) {
	mux.HandleFunc("GET /healthz", healthz)
}

func healthz(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	// A write error means the client has gone away; there is nothing left to do.
	_, _ = w.Write(healthyBody)
}
