import { useEffect, useMemo, useRef, useState } from "react";
import { useWebSocket } from "./useWebSocket";
import "./App.css";

const STATUS_LABEL: Record<string, string> = {
  connecting: "Connecting…",
  open: "Connected",
  reconnecting: "Reconnecting…",
  closed: "Disconnected",
};

const NameGate = ({ onJoin }: { onJoin: (name: string) => void }) => {
  const [value, setValue] = useState("");

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (trimmed) onJoin(trimmed);
  };

  return (
    <div className="gate">
      <div className="gate-card">
        <div className="gate-logo">yapper</div>
        <p className="gate-subtitle">Pick a name and start yapping.</p>
        <form onSubmit={handleSubmit} className="gate-form">
          <input
            autoFocus
            className="gate-input"
            placeholder="Your name"
            maxLength={32}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <button className="gate-button" type="submit" disabled={!value.trim()}>
            Start yapping
          </button>
        </form>
      </div>
    </div>
  );
};

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

const App = () => {
  const { status, messages, userCount, join, sendMessage } = useWebSocket();
  const [name, setName] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleJoin = (chosenName: string) => {
    setName(chosenName);
    join(chosenName);
  };

  const handleSend = (event: React.FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    sendMessage(text);
    setDraft("");
  };

  const statusLabel = useMemo(() => STATUS_LABEL[status] ?? status, [status]);

  if (!name) {
    return <NameGate onJoin={handleJoin} />;
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <span className="header-logo">yapper</span>
          <div className="header-meta">
            <span className="user-count">{userCount} online</span>
            <span className={`status-pill status-${status}`}>
              <span className="status-dot" />
              {statusLabel}
            </span>
          </div>
        </div>
      </header>

      <div className="message-list" ref={listRef}>
        {messages.map((message) =>
          message.kind === "system" ? (
            <div key={message.id} className="system-message">
              {message.text}
            </div>
          ) : (
            <div key={message.id} className={`message-row ${message.name === name ? "own" : ""}`}>
              {message.name !== name && <div className="avatar">{initialsOf(message.name)}</div>}
              <div className="bubble">
                {message.name !== name && <div className="bubble-name">{message.name}</div>}
                <div className="bubble-text">{message.text}</div>
              </div>
            </div>
          ),
        )}
      </div>

      <form className="composer" onSubmit={handleSend}>
        <input
          className="composer-input"
          placeholder="Say something…"
          maxLength={1000}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button className="composer-send" type="submit" disabled={!draft.trim()}>
          Send
        </button>
      </form>
    </div>
  );
};

export default App;
