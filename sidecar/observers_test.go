package main

import (
	"bytes"
	"context"
	"log"
	"strings"
	"testing"
	"time"
)

func TestClipboardObserverDoesNotLogInitialClipboardContents(t *testing.T) {
	originalReader := clipboardReader
	defer func() {
		clipboardReader = originalReader
	}()

	clipboardReader = func() (string, error) {
		return "super-secret-token-value", nil
	}

	var logs bytes.Buffer
	originalWriter := log.Writer()
	log.SetOutput(&logs)
	defer log.SetOutput(originalWriter)

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	observer := NewClipboardObserver(2000)

	go func() {
		defer close(done)
		observer.Run(ctx, func(_ context.Context, _ SidecarEvent, _ []byte) error { return nil })
	}()

	time.Sleep(100 * time.Millisecond)
	cancel()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("observer did not stop after context cancellation")
	}

	out := logs.String()
	if strings.Contains(out, "super-secret-token-value") {
		t.Fatalf("expected clipboard contents to be redacted, got logs: %s", out)
	}
	if !strings.Contains(out, "Initial content captured (24 bytes)") {
		t.Fatalf("expected sanitized clipboard metadata log, got: %s", out)
	}
}
