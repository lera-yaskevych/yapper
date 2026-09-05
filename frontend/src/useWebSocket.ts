import { useCallback, useEffect, useRef, useState } from "react";

export type ChatMessage =
  | { kind: "message"; id: string; name: string; text: string; timestamp: number }
  | { kind: "system"; id: string; text: string; timestamp: number };

export type ConnectionStatus = "connecting" | "open" | "reconnecting" | "closed";

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:8080";
const MAX_BACKOFF_MS = 10_000;
const TYPING_EXPIRY_MS = 4000;

export const useWebSocket = () => {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userCount, setUserCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const socketRef = useRef<WebSocket | null>(null);
  const nameRef = useRef<string | null>(null);
  const attemptRef = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);
  const typingExpiryTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const setUserTyping = useCallback((name: string, isTyping: boolean) => {
    const existingTimer = typingExpiryTimers.current.get(name);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    typingExpiryTimers.current.delete(name);

    setTypingUsers((prev) => {
      const next = new Set(prev);
      if (isTyping) {
        next.add(name);
      } else {
        next.delete(name);
      }

      return Array.from(next);
    });

    if (isTyping) {
      typingExpiryTimers.current.set(
        name,
        setTimeout(() => {
          typingExpiryTimers.current.delete(name);
          setTypingUsers((prev) => prev.filter((existing) => existing !== name));
        }, TYPING_EXPIRY_MS),
      );
    }
  }, []);

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
      } else if (data.type === "typing") {
        setUserTyping(data.name, data.isTyping);
      }
    };

    socket.onclose = () => {
      socketRef.current = null;
      if (unmountedRef.current) {
        return;
      }
      // Reconnect with exponential backoff in case of loss of connection
      setStatus("reconnecting");
      const delay = Math.min(1000 * 2 ** attemptRef.current, MAX_BACKOFF_MS);
      attemptRef.current += 1;
      reconnectTimer.current = setTimeout(connect, delay);
    };

    socket.onerror = () => {
      socket.close();
    };
  }, [setUserTyping]);

  useEffect(() => {
    // Open the connection once on mount — not on every render.
    unmountedRef.current = false;
    connect();
    return () => {
      unmountedRef.current = true;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      socketRef.current?.close();
      for (const timer of typingExpiryTimers.current.values()) {
        clearTimeout(timer);
      }
      typingExpiryTimers.current.clear();
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

  const sendTyping = useCallback((isTyping: boolean) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "typing", isTyping }));
    }
  }, []);

  return { status, messages, userCount, typingUsers, join, sendMessage, sendTyping };
};
