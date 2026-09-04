import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import express from "express";
import { WebSocketServer, WebSocket } from "ws";

interface ChatClient {
  id: string;
  name: string;
  socket: WebSocket;
}

type ClientMessage =
  | { type: "join"; name: string }
  | { type: "message"; text: string };

type ServerMessage =
  | { type: "message"; id: string; name: string; text: string; timestamp: number }
  | { type: "system"; text: string; timestamp: number }
  | { type: "user-count"; count: number };

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;

const app = express();
app.get("/health", (_req, res) => res.status(200).send("ok"));

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

// Tracked in memory only — connections disappear on restart.
const clients = new Map<string, ChatClient>();

function broadcast(message: ServerMessage, exclude?: string) {
  const payload = JSON.stringify(message);
  for (const client of clients.values()) {
    if (client.id === exclude) continue;
    if (client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(payload);
    }
  }
}

wss.on("connection", (socket) => {
  const id = randomUUID();
  // Name arrives via the first "join" message, not at connection time.
  let joined = false;

  socket.on("message", (raw) => {
    let parsed: ClientMessage;
    try {
      parsed = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (parsed.type === "join" && !joined) {
      const name = parsed.name.trim().slice(0, 32) || "Anonymous";
      clients.set(id, { id, name, socket });
      joined = true;
      broadcast({ type: "system", text: `${name} joined`, timestamp: Date.now() });
      broadcast({ type: "user-count", count: clients.size });
      return;
    }

    if (parsed.type === "message" && joined) {
      const client = clients.get(id);
      if (!client) return;
      const text = parsed.text.trim().slice(0, 1000);
      if (!text) return;
      broadcast({
        type: "message",
        id: randomUUID(),
        name: client.name,
        text,
        timestamp: Date.now(),
      });
    }
  });

  socket.on("close", () => {
    const client = clients.get(id);
    clients.delete(id);
    if (client) {
      broadcast({ type: "system", text: `${client.name} left`, timestamp: Date.now() });
      broadcast({ type: "user-count", count: clients.size });
    }
  });

  socket.on("error", () => {
    clients.delete(id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`yapper backend listening on :${PORT}`);
});
