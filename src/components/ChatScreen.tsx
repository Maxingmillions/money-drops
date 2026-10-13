"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Send, Shield } from "lucide-react";
import { api } from "@/lib/client";

type Msg = { id: string; body: string; createdAt: string; user: string; role: string; mine: boolean };

export function ChatScreen() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const lastId = useRef<string | null>(null);

  // Initial load + 3 s polling for new messages.
  useEffect(() => {
    let cancelled = false;
    const pull = async () => {
      try {
        const q = lastId.current ? `?after=${lastId.current}` : "";
        const r = await api<{ messages: Msg[] }>(`/api/chat${q}`);
        if (cancelled || r.messages.length === 0) return;
        lastId.current = r.messages[r.messages.length - 1].id;
        setMessages((m) => {
          const seen = new Set(m.map((x) => x.id));
          return [...m, ...r.messages.filter((x) => !seen.has(x.id))].slice(-300);
        });
      } catch {
        /* retry next tick */
      }
    };
    pull();
    const t = setInterval(pull, 3000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/chat", { method: "POST", json: { body } });
      setText("");
      // Pull immediately so the message shows without waiting for the poll.
      const q = lastId.current ? `?after=${lastId.current}` : "";
      const r = await api<{ messages: Msg[] }>(`/api/chat${q}`);
      if (r.messages.length) {
        lastId.current = r.messages[r.messages.length - 1].id;
        setMessages((m) => {
          const seen = new Set(m.map((x) => x.id));
          return [...m, ...r.messages.filter((x) => !seen.has(x.id))].slice(-300);
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page flex h-dvh flex-col px-0 pt-0 lg:h-[calc(100dvh-64px)] lg:px-10 lg:pt-8">
      <div className="flex items-center gap-3 border-b border-line px-5 py-4 lg:px-0">
        <Link href="/home" className="icon-btn lg:hidden">
          <ChevronLeft size={18} />
        </Link>
        <div>
        <h1 className="text-xl font-bold">Chat</h1>
        <p className="text-xs text-muted">Global room · hunters, hiders and bounty posters</p>
        </div>
      </div>
      <div ref={list} className="flex-1 overflow-y-auto px-5 py-4 lg:px-0">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-muted">No messages yet. Say hi.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`pop-in mb-2 flex ${m.mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${m.mine ? "bg-accent text-white" : "bg-elev shadow-[var(--shadow)]"}`}>
              {!m.mine && (
                <div className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold text-muted">
                  {m.user}
                  {(m.role === "MOD" || m.role === "ADMIN") && <Shield size={11} className="text-accent" />}
                </div>
              )}
              <div className="whitespace-pre-wrap break-words text-sm">{m.body}</div>
              <div className={`mt-0.5 text-right text-[10px] ${m.mine ? "text-white/70" : "text-faint"}`}>
                {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </div>
        ))}
      </div>
      <form
        className="flex items-center gap-2 border-t border-line bg-bg px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)] lg:px-0 lg:pb-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input className="input flex-1" placeholder="Message…" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} />
        <button type="submit" className="icon-btn !bg-accent !text-white" disabled={busy || !text.trim()} aria-label="Send">
          <Send size={18} />
        </button>
      </form>
      {error && <p className="px-5 pb-2 text-center text-xs text-danger">{error}</p>}
    </main>
  );
}
