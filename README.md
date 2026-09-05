# 🗣️ Yapper

A real-time chat app for people who just want to yap. One room, no login, no history — you show up, pick a name, and start talking. When you close the tab, it's like it never happened.

## What it actually does

- Real-time messaging over a raw WebSocket connection (no Socket.IO, no magic — just the actual protocol)
- Pick a display name, no signup, no password, no "verify your email" nonsense
- See who's online and how many people are currently yapping
- A little "so-and-so is typing…" indicator, because suspense is fun
- A connection status pill that honestly tells you when you've disconnected and are being reconnected, instead of just... not telling you
- Messages live entirely in server memory — refresh the server, and the conversation is gone forever. Very zen.

## Why this exists

Mostly as an excuse to actually understand WebSocket instead of just importing a library and hoping. Bonus goals: containerize it with Docker and deploy it with Kubernetes, so it's not just "a chat app" but "a chat app I can also explain the infrastructure of if someone asks in an interview."

## Tech stack

**Backend** — Node.js, TypeScript, Express (just for the `/health` route and general HTTP hosting), and the `ws` library for the actual WebSocket handling.

**Frontend** — React, TypeScript, Vite. A custom `useWebSocket` hook handles the connection, message state, and reconnect-with-backoff logic (because WebSocket does not reconnect for you — it just... gives up).

**Tooling** — Prettier for formatting, oxlint for linting (it's like ESLint but written in Rust and in a hurry).

## How it works, briefly

```
Browser  <── WebSocket ──>  Node/Express server
  │                                │
  │  join / message / typing       │  broadcasts to
  │  events sent as JSON           │  every connected client
```

Everything starts as a normal HTTP request. The server replies `101 Switching Protocols`, and from that point on the same connection is reused to send framed messages back and forth — no polling, no "let me just check the server every 3 seconds," just an open pipe both sides can talk through whenever they want.

## Running it locally

You'll need Node 20+ (there's an `.nvmrc`, so `nvm use` will sort you out if you have nvm).

**Backend:**

```bash
cd backend
npm install
npm run dev   # listens on :8080 by default
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev   # opens on :5173 by default
```

These are just the defaults — if something else on your machine is already squatting on that port, Vite will quietly pick the next one up (`:5174`, etc.) and print the real URL in the terminal, so check there if `localhost:5173` doesn't load. The backend doesn't auto-shift; if `:8080` is taken it'll just fail to start, so free it up or set `PORT=<something else>` before running `npm run dev`.

Open a couple of browser tabs pointed at whatever URL the frontend printed, pick different names, and yap at yourself. It's more fun with a friend, but no judgment.

## License

MIT — do whatever you want with it, just don't blame me if your friends find out how much you yap.
