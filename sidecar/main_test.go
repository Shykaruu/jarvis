package main

import "testing"

func TestApplyCLIOverrides(t *testing.T) {
	t.Run("brain_url flag overrides config", func(t *testing.T) {
		cfg := &SidecarConfig{
			Token:    "token",
			BrainURL: "wss://config.example/sidecar",
		}

		shouldSave, _ := applyCLIOverrides(cfg, "", "wss://cli.example/sidecar")
		if !shouldSave {
			t.Fatal("expected config save when CLI brain URL is provided")
		}
		if cfg.BrainURL != "wss://cli.example/sidecar" {
			t.Fatalf("expected CLI brain URL to win, got %q", cfg.BrainURL)
		}
	})

	t.Run("empty CLI values do not overwrite config", func(t *testing.T) {
		cfg := &SidecarConfig{
			Token:    "token",
			BrainURL: "wss://config.example/sidecar",
		}

		shouldSave, _ := applyCLIOverrides(cfg, "", "")
		if shouldSave {
			t.Fatal("did not expect save when no CLI overrides are provided")
		}
		if cfg.BrainURL != "wss://config.example/sidecar" {
			t.Fatalf("expected config brain URL to remain unchanged, got %q", cfg.BrainURL)
		}
	})
}
