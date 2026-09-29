package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"flag"
	"github.com/gorilla/websocket"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
)

type State struct {
	Car
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	Seq        int64   `json:"seq"`
	Lap        int     `json:"lap"`
	Checkpoint int     `json:"checkpoint"`
	Best       float64 `json:"best"`
	Last       float64 `json:"last"`
	Connected  bool    `json:"connected"`
}
type player struct {
	State
	token     string
	input     Controls
	lastInput time.Time
	seen      time.Time
	lapStart  int64
	peer      *connection
}
type connection struct {
	ws   *websocket.Conn
	send chan []byte
}
type race struct {
	players map[string]*player
	tick    int64
}
type game struct {
	sync.Mutex
	rooms map[string]*race
}

var validRoom = regexp.MustCompile("^[a-zA-Z0-9_-]{1,32}$")

func identifier(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
func (g *game) run() {
	ticker := time.NewTicker(time.Second / 30)
	defer ticker.Stop()
	for now := range ticker.C {
		g.Lock()
		for roomID, r := range g.rooms {
			r.tick++
			states := []State{}
			for id, p := range r.players {
				if !p.Connected && now.Sub(p.seen) > 60*time.Second {
					delete(r.players, id)
					continue
				}
				control := p.input
				if !p.Connected || now.Sub(p.lastInput) > 400*time.Millisecond {
					control = Controls{}
				}
				oldX := p.X
				step(&p.Car, control, 1.0/30)
				if p.Checkpoint == 0 && p.X > 1090 && p.Y > 230 && p.Y < 650 {
					p.Checkpoint = 1
				}
				if p.Checkpoint == 1 && p.Y < 230 && p.X > 350 && p.X < 1050 {
					p.Checkpoint = 2
				}
				if p.Checkpoint == 2 && p.X < 310 && p.Y > 230 && p.Y < 650 {
					p.Checkpoint = 3
				}
				if p.Checkpoint == 3 && p.Y > 620 && oldX < 700 && p.X >= 700 {
					p.Lap++
					p.Last = float64(r.tick-p.lapStart) / 30
					if p.Best == 0 || p.Last < p.Best {
						p.Best = p.Last
					}
					p.lapStart = r.tick
					p.Checkpoint = 0
				}
				states = append(states, p.State)
			}
			if len(states) == 0 {
				delete(g.rooms, roomID)
				continue
			}
			sort.Slice(states, func(i, j int) bool { return states[i].ID < states[j].ID })
			data, _ := json.Marshal(map[string]any{"type": "snapshot", "tick": r.tick, "players": states})
			for _, p := range r.players {
				if p.peer != nil {
					select {
					case p.peer.send <- data:
					default:
					}
				}
			}
		}
		g.Unlock()
	}
}
func (g *game) connect(w http.ResponseWriter, req *http.Request) {
	name := req.URL.Query().Get("room")
	if !validRoom.MatchString(name) {
		http.Error(w, "Invalid room", 400)
		return
	}
	display := strings.TrimSpace(req.URL.Query().Get("name"))
	if display == "" {
		display = "Driver"
	}
	if len([]rune(display)) > 20 {
		display = string([]rune(display)[:20])
	}
	upgrade := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool {
		raw := r.Header.Get("Origin")
		if raw == "" {
			return true
		}
		u, err := url.Parse(raw)
		return err == nil && (u.Host == r.Host || u.Host == "127.0.0.1:5179" || u.Host == "localhost:5179")
	}}
	ws, err := upgrade.Upgrade(w, req, nil)
	if err != nil {
		return
	}
	defer ws.Close()
	ws.SetReadLimit(4096)
	c := &connection{ws: ws, send: make(chan []byte, 4)}
	g.Lock()
	r := g.rooms[name]
	if r == nil {
		if len(g.rooms) >= 32 {
			g.Unlock()
			return
		}
		r = &race{players: map[string]*player{}}
		g.rooms[name] = r
	}
	var p *player
	token := req.URL.Query().Get("token")
	for _, candidate := range r.players {
		if candidate.token == token && token != "" {
			p = candidate
			break
		}
	}
	if p == nil {
		if len(r.players) >= 8 {
			g.Unlock()
			_ = ws.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(1008, "Room is full (8 drivers)."), time.Now().Add(time.Second))
			return
		}
		p = &player{State: State{Car: Car{X: 590 - float64(len(r.players))*25, Y: 690}, ID: identifier(4), Name: display}, token: identifier(16), lapStart: r.tick}
		r.players[p.ID] = p
	}
	if p.peer != nil {
		p.peer.ws.Close()
	}
	p.peer = c
	p.Connected = true
	p.seen = time.Now()
	p.Name = display
	welcome, _ := json.Marshal(map[string]any{"type": "welcome", "id": p.ID, "token": p.token, "seq": p.Seq, "hz": 30})
	g.Unlock()
	_ = ws.SetWriteDeadline(time.Now().Add(5 * time.Second))
	if ws.WriteMessage(websocket.TextMessage, welcome) != nil {
		g.Lock()
		if p.peer == c {
			p.peer = nil
			p.Connected = false
			p.seen = time.Now()
		}
		g.Unlock()
		return
	}
	done := make(chan struct{})
	defer close(done)
	defer func() {
		g.Lock()
		if p.peer == c {
			p.peer = nil
			p.Connected = false
			p.seen = time.Now()
			p.input = Controls{}
		}
		g.Unlock()
	}()
	go func() {
		defer ws.Close()
		ticker := time.NewTicker(20 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-done:
				return
			case data := <-c.send:
				_ = ws.SetWriteDeadline(time.Now().Add(5 * time.Second))
				if ws.WriteMessage(websocket.TextMessage, data) != nil {
					return
				}
			case <-ticker.C:
				if ws.WriteControl(websocket.PingMessage, nil, time.Now().Add(5*time.Second)) != nil {
					return
				}
			}
		}
	}()
	_ = ws.SetReadDeadline(time.Now().Add(60 * time.Second))
	ws.SetPongHandler(func(string) error { return ws.SetReadDeadline(time.Now().Add(60 * time.Second)) })
	for {
		var msg struct {
			Type string `json:"type"`
			Seq  int64  `json:"seq"`
			Controls
			Time float64 `json:"time"`
		}
		if ws.ReadJSON(&msg) != nil {
			return
		}
		g.Lock()
		if p.peer != c {
			g.Unlock()
			return
		}
		switch msg.Type {
		case "input":
			if msg.Seq > p.Seq && msg.Seq-p.Seq < 10000 {
				p.Seq = msg.Seq
				p.input = msg.Controls
				p.lastInput = time.Now()
			}
		case "ping":
			data, _ := json.Marshal(map[string]any{"type": "pong", "time": msg.Time})
			select {
			case c.send <- data:
			default:
			}
		case "reset":
			p.Car = Car{X: 590, Y: 690}
			p.input = Controls{}
			p.Checkpoint = 0
			p.lapStart = r.tick
		}
		g.Unlock()
	}
}
func main() {
	addr := flag.String("addr", "127.0.0.1:8093", "Listen address")
	web := flag.String("web", "web/dist", "Frontend directory")
	flag.String("data", ".data", "Reserved for test launcher compatibility")
	flag.Parse()
	g := &game{rooms: map[string]*race{}}
	go g.run()
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", g.connect)
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok","tickRate":30,"maxPlayers":8}`))
	})
	mux.Handle("/", http.FileServer(http.Dir(*web)))
	log.Printf("Circuit beta: http://%s", *addr)
	log.Fatal((&http.Server{Addr: *addr, Handler: mux, ReadHeaderTimeout: 5 * time.Second, IdleTimeout: 60 * time.Second}).ListenAndServe())
}
