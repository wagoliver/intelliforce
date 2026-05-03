"use client";

import { useState } from "react";

type Msg = { id: string; role: "user" | "agent"; text: string };

export default function SkillsPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/proxy/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, session_id: sessionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.detail === "string" ? data.detail : `HTTP ${res.status}`);
        return;
      }
      if (!data.success) {
        setError(data.error_message || "Erro desconhecido");
        return;
      }
      if (data.session_id) setSessionId(data.session_id);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "agent", text: data.text || "(resposta vazia)" },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 900, margin: "0 auto" }}>
      <header>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 500, margin: 0, letterSpacing: "-0.015em" }}>
          Skill · chat com OpenCode
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-subtle)", marginTop: 4 }}>
          Fase 1 (síncrono, sem streaming, sem visual). Feio mas funcional.
        </p>
      </header>

      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 16,
          minHeight: 360,
          maxHeight: 540,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          background: "var(--bg-elev)",
        }}
      >
        {messages.length === 0 && !loading && (
          <div style={{ color: "var(--text-subtle)", fontSize: 13 }}>
            Sem mensagens. Manda um &quot;olá&quot; pra testar a conexão com OpenCode.
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "10px 12px",
              background: m.role === "user" ? "var(--bg-sunken)" : "var(--bg)",
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "82%",
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                fontFamily: "var(--font-mono)",
                color: "var(--text-subtle)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: 6,
              }}
            >
              {m.role === "user" ? "você" : "opencode"}
            </div>
            <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.55, color: "var(--text)" }}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ color: "var(--text-subtle)", fontSize: 12, fontStyle: "italic" }}>
            OpenCode pensando…
          </div>
        )}
      </div>

      {error && (
        <div
          style={{
            color: "var(--danger)",
            fontSize: 12.5,
            padding: "8px 12px",
            border: "1px solid var(--danger)",
            borderRadius: 6,
            background: "var(--danger-soft)",
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="O que você quer construir?"
          disabled={loading}
          style={{
            flex: 1,
            padding: "10px 14px",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 14,
            background: "var(--bg-elev)",
            color: "var(--text)",
            outline: "none",
            fontFamily: "inherit",
          }}
        />
        <button
          onClick={() => void send()}
          disabled={loading || !input.trim()}
          style={{
            padding: "10px 22px",
            border: "1px solid var(--text)",
            borderRadius: 8,
            background: "var(--text)",
            color: "var(--bg)",
            fontSize: 14,
            fontWeight: 500,
            cursor: loading || !input.trim() ? "not-allowed" : "pointer",
            opacity: loading || !input.trim() ? 0.55 : 1,
            fontFamily: "inherit",
          }}
        >
          Enviar
        </button>
      </div>

      {sessionId && (
        <div style={{ fontSize: 11, color: "var(--text-subtle)", fontFamily: "var(--font-mono)" }}>
          session: {sessionId}
        </div>
      )}
    </div>
  );
}
