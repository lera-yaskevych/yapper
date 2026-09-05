import { useCallback, useEffect, useRef, useState } from "react";

export type ChatMessage =
  | { kind: "message"; id: string; name: string; text: string; timestamp: number }
  | { kind: "system"; id: string; text: string; timestamp: number };

export type ConnectionStatus = "connecting" | "open" | "reconnecting" | "closed";

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:8080";
const MAX_BACKOFF_MS = 10_000;

export const useWebSocket = () => {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userCount, setUserCount] = useState(0);

  const socketRef = useRef<WebSocket | null>(null);
  const nameRef = useRef<string | null>(null);
  const attemptRef = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  const connect = useCallback(() => {
    const socket = new WebSocket(WS_URL);
    socketRef.current = socket;

    socket.onopen = () => {
      attemptRef.current = 0;
      setStatus("open");
      if (nameRef.current) {
        socket.send(JSON.stringify({ type: "join", name: nameRef.current }));
      }
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "message") {
        setMessages((prev) => [
          ...prev,
          {
            kind: "message",
            id: data.id,
            name: data.name,
            text: data.text,
            timestamp: data.timestamp,
          },
        ]);
      } else if (data.type === "system") {
        setMessages((prev) => [
          ...prev,
          {
            kind: "system",
            id: `${data.timestamp}-${Math.random()}`,
            text: data.text,
            timestamp: data.timestamp,
          },
        ]);
      } else if (data.type === "user-count") {
        setUserCount(data.count);
      }
    };

    socket.onclose = () => {
      socketRef.current = null;
      if (unmountedRef.current) return;
      // Reconnect with exponential backoff in case of loss of connection
      setStatus("reconnecting");
      const delay = Math.min(1000 * 2 ** attemptRef.current, MAX_BACKOFF_MS);
      attemptRef.current += 1;
      reconnectTimer.current = setTimeout(connect, delay);
    };

    socket.onerror = () => {
      socket.close();
    };
  }, []);

  useEffect(() => {
    // Open the connection once on mount — not on every render.
    unmountedRef.current = false;
    connect();
    return () => {
      unmountedRef.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      socketRef.current?.close();
    };
  }, [connect]);

  const join = useCallback((name: string) => {
    nameRef.current = name;
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "join", name }));
    }
  }, []);

  const sendMessage = useCallback((text: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "message", text }));
    }
  }, []);

  return { status, messages, userCount, join, sendMessage };
};
