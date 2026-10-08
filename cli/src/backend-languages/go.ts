// Copyright (c) 2026 TDK Landscape contributors
// SPDX-License-Identifier: MIT
import type { BackendLanguageProvider } from "./types.js";

/**
 * Go has no reload process inside the image, so the dev command is only what a developer would run by
 * hand. Tilt rebuilds the image when a watched file changes (the engine returns no live-update rules).
 */
export const GO_DEV_COMMAND = "go run .";

export const goBackendProvider: BackendLanguageProvider = {
  id: "go",
  label: "Go 1.23 (net/http)",
  devCommand: GO_DEV_COMMAND,
  watch: ["**/*.go", "go.mod", "go.sum"],
  installHint: "go mod tidy   # optional: Docker builds the image for you",
  createFiles(name) {
    return [
      {
        filename: "go.mod",
        content: `module ${name}

go 1.23
`,
        description: "Generating go.mod",
        emoji: "📦",
      },
      {
        filename: "main.go",
        content: `package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
)

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func newMux() *http.ServeMux {
	mux := http.NewServeMux()

	// Health check endpoint (required by TILT_RESOURCE_DEFAULTS.star)
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "${name}"})
	})

	mux.HandleFunc("GET /{$}", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"service":   "${name}",
			"version":   "1.0.0",
			"endpoints": []string{"/health"},
		})
	})

	return mux
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	// ":" + port listens on every interface, which Traefik needs inside the container network.
	log.Printf("${name} listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, newMux()))
}
`,
        description: "Generating backend source",
        emoji: "💻",
      },
      {
        filename: "main_test.go",
        content: `package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealth(t *testing.T) {
	rec := httptest.NewRecorder()
	newMux().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/health", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("GET /health = %d, want %d", rec.Code, http.StatusOK)
	}
}
`,
        description: "Generating smoke test",
        emoji: "🧪",
      },
    ];
  },
};
