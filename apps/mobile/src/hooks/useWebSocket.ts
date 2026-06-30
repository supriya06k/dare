import { useEffect, useRef, useCallback } from "react";
import { getToken } from "../lib/api";

const BASE_WS = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8080")
  .replace(/^http/, "ws");

type Handler = (type: string, payload: unknown) => void;

export function useWebSocket(dareId: string | number, onMessage: Handler) {
  const ws = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(async () => {
    const token = await getToken();
    if (!token) return;

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
      if (!e.wasClean) {
        setTimeout(connect, 3000);
      }
    };
  }, [dareId]);

  useEffect(() => {
    connect();
    return () => {
      ws.current?.close(1000);
    };
  }, [connect]);
}
