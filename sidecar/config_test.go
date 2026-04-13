package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLoadConfigPreservesBrainURL(t *testing.T) {
	originalDir := configDir
	originalFile := configFile
	tempDir := t.TempDir()
	configDir = tempDir
	configFile = filepath.Join(tempDir, "config.yaml")
	defer func() {
		configDir = originalDir
		configFile = originalFile
	}()

	cfg := defaultConfig()
	cfg.Token = "token"
	cfg.BrainURL = "  wss://axiom-er.ddns.net/sidecar  "

	if err := SaveConfig(&cfg); err != nil {
		t.Fatalf("SaveConfig() error = %v", err)
	}

	loaded, err := LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig() error = %v", err)
	}

	if loaded.BrainURL != "wss://axiom-er.ddns.net/sidecar" {
		t.Fatalf("expected trimmed brain_url, got %q", loaded.BrainURL)
	}
}

func TestResolveBrainURLPrefersConfigOverride(t *testing.T) {
	cfg := &SidecarConfig{BrainURL: "wss://axiom-er.ddns.net/sidecar"}
	claims := &SidecarTokenClaims{Brain: "ws://localhost:3142/sidecar/connect"}

	got := resolveBrainURL(cfg, claims)
	if got != "wss://axiom-er.ddns.net/sidecar" {
		t.Fatalf("expected config brain_url, got %q", got)
	}
}

func TestResolveBrainURLFallsBackToTokenClaim(t *testing.T) {
	cfg := &SidecarConfig{}
	claims := &SidecarTokenClaims{Brain: "ws://localhost:3142/sidecar/connect"}

	got := resolveBrainURL(cfg, claims)
	if got != "ws://localhost:3142/sidecar/connect" {
		t.Fatalf("expected token claim fallback, got %q", got)
	}
}

func TestUpdateConfigHandlerPersistsBrainURL(t *testing.T) {
	originalDir := configDir
	originalFile := configFile
	tempDir := t.TempDir()
	configDir = tempDir
	configFile = filepath.Join(tempDir, "config.yaml")
	defer func() {
		configDir = originalDir
		configFile = originalFile
	}()

	cfg := defaultConfig()
	cfg.Token = "token"

	reloaded := false
	handler := makeUpdateConfigHandler(&cfg, func() {
		reloaded = true
	})

	_, err := handler(map[string]any{
		"brain_url": "wss://axiom-er.ddns.net/sidecar",
	})
	if err != nil {
		t.Fatalf("update_config error = %v", err)
	}

	if !reloaded {
		t.Fatal("expected reload callback to run")
	}

	if cfg.BrainURL != "wss://axiom-er.ddns.net/sidecar" {
		t.Fatalf("expected in-memory brain_url update, got %q", cfg.BrainURL)
	}

	data, err := os.ReadFile(configFile)
	if err != nil {
		t.Fatalf("expected persisted config, read error = %v", err)
	}

	if string(data) == "" || !strings.Contains(string(data), "brain_url: wss://axiom-er.ddns.net/sidecar") {
		t.Fatalf("expected saved config to include brain_url, got %q", string(data))
	}
}
