package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"
)

func applyCLIOverrides(cfg *SidecarConfig, token string, brainURL string) (bool, string) {
	token = strings.TrimSpace(token)
	brainURL = strings.TrimSpace(brainURL)

	if token != "" {
		cfg.Token = token
	}
	if brainURL != "" {
		cfg.BrainURL = brainURL
	}

	if token != "" && brainURL != "" {
		return true, "[sidecar] Token and brain URL saved to config"
	}
	if token != "" {
		return true, "[sidecar] Token saved to config"
	}
	if brainURL != "" {
		return true, "[sidecar] Brain URL saved to config"
	}
	return false, ""
}

func main() {
	token := flag.String("token", "", "JWT enrollment token from the brain")
	brainURL := flag.String("brain-url", "", "Override the brain WebSocket URL")
	help := flag.Bool("help", false, "Show help")
	flag.Parse()

	if *help {
		fmt.Println(`jarvis-sidecar — Jarvis sidecar client (Go)

Usage:
  jarvis-sidecar --token <jwt>    Enroll and start (saves token to config)
  jarvis-sidecar --brain-url <ws-url>  Override and save the brain WebSocket URL
  jarvis-sidecar                  Start using saved token
  jarvis-sidecar --help           Show this help`)
		os.Exit(0)
	}

	cfg, err := LoadConfig()
	if err != nil {
		log.Fatalf("[sidecar] Failed to load config: %v", err)
	}

	shouldSave, saveMessage := applyCLIOverrides(cfg, *token, *brainURL)
	if shouldSave {
		if err := SaveConfig(cfg); err != nil {
			log.Fatalf("[sidecar] Failed to save config: %v", err)
		}
		log.Println(saveMessage)
	}

	if cfg.Token == "" {
		fmt.Fprintln(os.Stderr, "Error: No token configured. Run with --token <jwt> first.")
		os.Exit(1)
	}

	client, err := NewSidecarClient(cfg)
	if err != nil {
		log.Fatalf("[sidecar] Failed to create client: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigCh
		log.Println("\n[sidecar] Shutting down...")
		client.Stop()
		cancel()
	}()

	client.Start(ctx)
}
