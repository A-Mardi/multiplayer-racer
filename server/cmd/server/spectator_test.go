package main

import (
	"github.com/gorilla/websocket"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestSpectatorsDoNotConsumeDriverSeatsOrAcceptControls(t *testing.T) {
	g := &game{rooms: map[string]*race{}}
	server := httptest.NewServer(http.HandlerFunc(g.connect))
	defer server.Close()
	endpoint := "ws" + strings.TrimPrefix(server.URL, "http") + "?room=spec-test"
	dial := func(watch bool) (*websocket.Conn, map[string]any) {
		t.Helper()
		url := endpoint
		if watch {
			url += "&spectate=1"
		}
		ws, _, err := websocket.DefaultDialer.Dial(url, nil)
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { ws.Close() })
		ws.SetReadDeadline(time.Now().Add(3 * time.Second))
		var welcome map[string]any
		if err := ws.ReadJSON(&welcome); err != nil {
			t.Fatal(err)
		}
		return ws, welcome
	}
	spectator, welcome := dial(true)
	if welcome["role"] != "spectator" || welcome["token"] != nil {
		t.Fatal("spectator received a driver identity")
	}
	for i := 0; i < 8; i++ {
		_, welcome = dial(false)
		if welcome["role"] != "driver" {
			t.Fatal("spectator consumed a driver seat")
		}
	}
	for i := 1; i < 16; i++ {
		dial(true)
	}
	for _, extra := range []string{"", "&spectate=1"} {
		ws, _, err := websocket.DefaultDialer.Dial(endpoint+extra, nil)
		if err != nil {
			t.Fatal(err)
		}
		ws.SetReadDeadline(time.Now().Add(3 * time.Second))
		_, _, err = ws.ReadMessage()
		ws.Close()
		if !websocket.IsCloseError(err, 1008) {
			t.Fatalf("expected capacity rejection: %v", err)
		}
	}
	g.Lock()
	for _, p := range g.rooms["spec-test"].players {
		p.X = 999
	}
	g.Unlock()
	for _, msg := range []map[string]any{{"type": "input", "seq": 99, "up": true}, {"type": "reset"}, {"type": "ping", "time": 123}} {
		if err := spectator.WriteJSON(msg); err != nil {
			t.Fatal(err)
		}
	}
	var pong map[string]any
	if err := spectator.ReadJSON(&pong); err != nil {
		t.Fatal(err)
	}
	if pong["type"] != "pong" {
		t.Fatal("spectator ping failed")
	}
	g.Lock()
	defer g.Unlock()
	r := g.rooms["spec-test"]
	if len(r.players) != 8 || len(r.spectators) != 16 {
		t.Fatal("independent seat limits violated")
	}
	for _, p := range r.players {
		if p.X != 999 || p.Seq != 0 || p.input.Up {
			t.Fatal("spectator changed driver state")
		}
	}
}
