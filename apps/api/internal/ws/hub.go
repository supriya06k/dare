package ws

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"sync"

	"github.com/go-chi/chi/v5"
	"golang.org/x/net/websocket"
)

type Message struct {
	Type    string `json:"type"`
	DareID  string `json:"dareId,omitempty"`
	Payload any    `json:"payload"`
}

type Client struct {
	dareID string
	send   chan Message
	hub    *Hub
}

type Hub struct {
	rooms  map[string]map[*Client]bool
	mu     sync.RWMutex
	reg    chan *Client
	unreg  chan *Client
	bcast  chan Message
}

func NewHub() *Hub {
	return &Hub{
		rooms: make(map[string]map[*Client]bool),
		reg:   make(chan *Client, 64),
		unreg: make(chan *Client, 64),
		bcast: make(chan Message, 512),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case c := <-h.reg:
			h.mu.Lock()
			if h.rooms[c.dareID] == nil {
				h.rooms[c.dareID] = make(map[*Client]bool)
			}
			h.rooms[c.dareID][c] = true
			h.mu.Unlock()

		case c := <-h.unreg:
			h.mu.Lock()
			if room, ok := h.rooms[c.dareID]; ok {
				delete(room, c)
				if len(room) == 0 {
					delete(h.rooms, c.dareID)
				}
			}
			h.mu.Unlock()
			close(c.send)

		case msg := <-h.bcast:
			h.mu.RLock()
			for c := range h.rooms[msg.DareID] {
				select {
				case c.send <- msg:
				default:
					// slow client — drop message rather than block hub
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) Broadcast(dareID string, msgType string, payload any) {
	h.bcast <- Message{Type: msgType, DareID: dareID, Payload: payload}
}

func (h *Hub) ServeWS(w http.ResponseWriter, r *http.Request) {
	dareID := chi.URLParam(r, "dareId")
	websocket.Handler(func(conn *websocket.Conn) {
		c := &Client{dareID: dareID, send: make(chan Message, 32), hub: h}
		h.reg <- c
		defer func() { h.unreg <- c }()

		// Writer goroutine
		go func() {
			for msg := range c.send {
				if err := websocket.JSON.Send(conn, msg); err != nil {
					slog.Warn("ws send error", "err", err)
					return
				}
			}
		}()

		// Reader — keep alive, discard client messages
		buf := make([]byte, 256)
		for {
			_, err := conn.Read(buf)
			if err != nil {
				return
			}
		}
	}).ServeHTTP(w, r)
}

// VoteUpdate is broadcast to all watchers of a dare when a vote lands
type VoteUpdate struct {
	PassVotes int `json:"passVotes"`
	FailVotes int `json:"failVotes"`
	Total     int `json:"total"`
}

// DropStatusUpdate is broadcast when a drop transitions state
type DropStatusUpdate struct {
	DropID int64  `json:"dropId"`
	Status string `json:"status"`
}

func encode(v any) []byte {
	b, _ := json.Marshal(v)
	return b
}

var _ = encode // used indirectly
