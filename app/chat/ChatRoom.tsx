"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/types";

const POLL_MS = 2000;

interface Props {
  thread: string;
  title: string;
  subtitle: string;
  me: string;
  initialMessages: ChatMessage[];
}

function merge(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const seen = new Set(current.map((m) => m.message_id));
  const fresh = incoming.filter((m) => !seen.has(m.message_id));
  return fresh.length === 0 ? current : [...current, ...fresh].sort((a, b) => a.message_id - b.message_id);
}

export function ChatRoom({ thread, title, subtitle, me, initialMessages }: Props) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastId = useRef(initialMessages.at(-1)?.message_id ?? 0);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    lastId.current = messages.at(-1)?.message_id ?? 0;
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(`/api/messages?thread=${encodeURIComponent(thread)}&after=${lastId.current}`, { cache: "no-store" });
        if (res.status === 401) {
          if (!cancelled) setError("You've been logged out. Log in again to keep chatting.");
          return;
        }
        if (!res.ok) return;
        const body = (await res.json()) as { messages: ChatMessage[] };
        if (!cancelled && body.messages.length > 0) setMessages((current) => merge(current, body.messages));
      } catch {
        // Try again on the next tick.
      }
    };
    const timer = setInterval(refresh, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [thread]);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ thread, body: text }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not send.");
      setMessages((current) => merge(current, [body.message as ChatMessage]));
      setDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="panel room">
      <div className="room-header">
        <strong>{title}</strong> <span className="muted">· {subtitle}</span>
      </div>

      <div className="messages">
        {messages.length === 0 ? <p className="muted">No messages yet. Say hi.</p> : null}
        {messages.map((m) => (
          <div key={m.message_id} className={`message${m.sender_user_id === me ? " mine" : ""}`}>
            <div className="meta">
              {m.sender_name}
              {m.sender_role === "coach" ? " (Coach)" : ""} · {new Date(m.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
              {m.via === "imessage" ? " · by text" : ""}
            </div>
            <div className="body">{m.body}</div>
          </div>
        ))}
        <div ref={bottom} />
      </div>

      {error ? (
        <p className="error" style={{ margin: "0 16px" }}>
          {error}
        </p>
      ) : null}
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          rows={2}
          value={draft}
          maxLength={2000}
          placeholder="Write a message. Enter sends, Shift+Enter adds a line."
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button type="submit" disabled={sending || !draft.trim()}>
          {sending ? "Sending…" : "Send"}
        </button>
      </form>
    </section>
  );
}
