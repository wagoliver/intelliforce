"use client";

import { useEffect, useRef, useState } from "react";

import { useChatStream } from "./hooks/useChatStream";
import type { ChatMessage, ToolCall } from "./state/types";

export default function SkillsPage() {
  const { state, send } = useChatStream();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll quando entra mensagem nova ou texto streaming
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.messages]);

  function onSubmit() {
    if (!input.trim() || state.isStreaming) return;
    void send(input);
    setInput("");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 900, margin: "0 auto" }}>
      <header>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 22,
            fontWeight: 500,
            margin: 0,
            letterSpacing: "-0.015em",
          }}
        >
          Skill · chat com OpenCode
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-subtle)", marginTop: 4 }}>
          Fase 2 (streaming SSE, sem visual cinematográfico ainda).
        </p>
      </header>

      <div
        ref={scrollRef}
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
        {state.messages.length === 0 && !state.isStreaming && (
          <div style={{ color: "var(--text-subtle)", fontSize: 13 }}>
            Sem mensagens. Manda um &quot;olá&quot; pra testar a conexão com OpenCode.
          </div>
        )}
        {state.messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {state.isStreaming && (
          <div style={{ color: "var(--text-subtle)", fontSize: 12, fontStyle: "italic" }}>
            OpenCode está pensando…
          </div>
        )}
      </div>

      {state.error && (
        <div
          role="alert"
          style={{
            color: "var(--danger)",
            fontSize: 12.5,
            padding: "8px 12px",
            border: "1px solid var(--danger)",
            borderRadius: 6,
            background: "var(--danger-soft)",
          }}
        >
          {state.error}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder="O que você quer construir?"
          disabled={state.isStreaming}
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
          onClick={onSubmit}
          disabled={state.isStreaming || !input.trim()}
          style={{
            padding: "10px 22px",
            border: "1px solid var(--text)",
            borderRadius: 8,
            background: "var(--text)",
            color: "var(--bg)",
            fontSize: 14,
            fontWeight: 500,
            cursor: state.isStreaming || !input.trim() ? "not-allowed" : "pointer",
            opacity: state.isStreaming || !input.trim() ? 0.55 : 1,
            fontFamily: "inherit",
          }}
        >
          Enviar
        </button>
      </div>

      {state.sessionId && (
        <div style={{ fontSize: 11, color: "var(--text-subtle)", fontFamily: "var(--font-mono)" }}>
          session: {state.sessionId}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: "10px 12px",
        background: isUser ? "var(--bg-sunken)" : "var(--bg)",
        alignSelf: isUser ? "flex-end" : "flex-start",
        maxWidth: "82%",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          fontFamily: "var(--font-mono)",
          color: "var(--text-subtle)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {isUser ? "você" : "opencode"}
      </div>
      {!isUser && message.toolCalls.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {message.toolCalls.map((tc) => (
            <ToolCallLine key={tc.id} call={tc} />
          ))}
        </div>
      )}
      {message.text && (
        <div
          style={{
            whiteSpace: "pre-wrap",
            fontSize: 13.5,
            lineHeight: 1.55,
            color: "var(--text)",
          }}
        >
          {message.text}
        </div>
      )}
      {!isUser && message.error && (
        <div style={{ fontSize: 11.5, color: "var(--danger)" }}>{message.error}</div>
      )}
    </div>
  );
}

function ToolCallLine({ call }: { call: ToolCall }) {
  const icon = call.status === "running" ? "▸" : call.status === "done" ? "✓" : "✕";
  const color =
    call.status === "running"
      ? "var(--text-muted)"
      : call.status === "done"
        ? "var(--success)"
        : "var(--danger)";
  return (
    <div
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 11.5,
        color,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span style={{ width: 12, textAlign: "center" }}>{icon}</span>
      <span style={{ fontWeight: 500 }}>{call.tool}</span>
      {call.description && (
        <span style={{ color: "var(--text-subtle)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {call.description}
        </span>
      )}
    </div>
  );
}
