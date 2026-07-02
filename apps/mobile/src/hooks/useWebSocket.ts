import { useEffect, useRef, useCallback } from "react";
import { getToken } from "../lib/api";

const BASE_WS = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8080")
  .replace(/^http/, "ws");

type Handler = (type: string, payload: unknown) => void;

export function useWebSocket(dareId: string | number, onMessage: Handler) {
  const ws = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closed = useRef(false);

  const connect = useCallback(async () => {
    if (closed.current) return;
    const token = await getToken();
    if (!token || closed.current) return;

    const url = `${BASE_WS}/ws/live/${dareId}?token=${token}`;
    const socket = new WebSocket(url);
    ws.current = socket;

    socket.onmessage = (e) => {
      try {
        const { type, payload } = JSON.parse(e.data);
        onMessageRef.current(type, payload);
      } catch {}
    };

    socket.onclose = (e) => {
      if (!e.wasClean && !closed.current) {
        reconnectTimer.current = setTimeout(connect, 3000);
      }
    };
  }, [dareId]);

  useEffect(() => {
    closed.current = false;
    connect();
    return () => {
      closed.current = true;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      ws.current?.close(1000);
      ws.current = null;
    };
  }, [connect]);
}
