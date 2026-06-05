"use client";

import { Send, Square, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { MarkdownView } from "@/components/chat/MarkdownView";
import { NeuralRibbons } from "@/components/chat/NeuralRibbons";
import { useVoice } from "@/lib/voice/useVoice";

import { useChatStream } from "./hooks/useChatStream";
import type { ChatMessage } from "./state/types";

const AGENTS = [
  { key: "operator", label: "Operador" },
  { key: "builder", label: "Construtor" },
] as const;

/** Remove sintaxe markdown pra ficar natural na fala (TTS). */
function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " (bloco de código) ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/^>\s?/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/\n{2,}/g, ". ")
    .trim();
}

export default function CommandPage() {
  const { state, send, abort } = useChatStream();
  const { speak } = useVoice({ lang: "pt-BR" });
  const [agent, setAgent] = useState<string>("operator");
  const [text, setText] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [state.messages, state.isStreaming]);

  const hasMessages = state.messages.length > 0;

  function submitText() {
    const t = text.trim();
    if (!t || state.isStreaming) return;
    void send(t, agent);
    setText("");
  }

  // Agente + campo de texto (entrada via teclado / mic do teclado).
  const controls = (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-2 flex justify-center gap-1.5">
        {AGENTS.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => setAgent(a.key)}
            className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
              agent === a.key ? "bg-accent text-white" : "bg-bg-subtle text-fg-muted"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>
      <div className="flex items-end gap-2">
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submitText();
            }
          }}
          rows={1}
          placeholder="Pergunte ou digite…"
          className="input max-h-32 flex-1 resize-none"
        />
        {state.isStreaming ? (
          <button
            type="button"
            onClick={abort}
            aria-label="Parar"
            className="btn-primary !bg-danger !px-3 hover:!bg-danger/90"
          >
            <Square size={18} />
          </button>
        ) : (
          <button
            type="button"
            onClick={submitText}
            disabled={!text.trim()}
            aria-label="Enviar"
            className="btn-primary btn-gradient !px-3"
          >
            <Send size={18} />
          </button>
        )}
      </div>
    </div>
  );

  // Sem conversa: linhas neurais como "campo" central + dica + controles.
  if (!hasMessages) {
    return (
      <div className="flex min-h-[58dvh] flex-col items-center justify-center gap-5">
        <button
          type="button"
          onClick={() => taRef.current?.focus()}
          aria-label="Tocar para ditar pelo teclado"
          className="relative block h-44 w-full max-w-md overflow-hidden rounded-2xl border border-border bg-bg-panel/40"
        >
          <NeuralRibbons dimmed={false} />
        </button>
        <p className="px-6 text-center text-xs text-fg-muted">
          Toque nas linhas e dite pelo microfone do teclado, ou escreva abaixo.
        </p>
        {controls}
      </div>
    );
  }

  // Com conversa: mensagens rolam + composer fixo com faixa de linhas.
  return (
    <>
      <div className="flex flex-col gap-3 pb-[220px]">
        {state.messages.map((m) => (
          <MessageBubble key={m.id} m={m} onSpeak={(t) => speak(stripMarkdown(t))} />
        ))}
        <div ref={bottomRef} />
      </div>

      <div
        className="fixed inset-x-0 z-20 border-t border-border bg-bg-panel/95 px-4 pt-2.5 backdrop-blur"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 58px)" }}
      >
        <button
          type="button"
          onClick={() => taRef.current?.focus()}
          aria-label="Tocar para ditar pelo teclado"
          className="relative mb-2 block h-10 w-full overflow-hidden rounded-lg"
        >
          <NeuralRibbons dimmed={!state.isStreaming} />
        </button>
        {controls}
      </div>
    </>
  );
}

function MessageBubble({ m, onSpeak }: { m: ChatMessage; onSpeak: (text: string) => void }) {
  if (m.role === "user") {
    return (
      <div className="max-w-[85%] self-end whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-accent px-3.5 py-2.5 text-sm text-white">
        {m.text}
      </div>
    );
  }

  return (
    <div className="w-full max-w-[92%] self-start">
      {m.toolCalls.length > 0 && (
        <div className="mb-1 flex flex-col gap-0.5">
          {m.toolCalls.map((tc) => (
            <div key={tc.id} className="flex items-center gap-1.5 text-[11px] text-fg-subtle">
              <span>{tc.status === "running" ? "⏳" : tc.status === "error" ? "⚠️" : "✓"}</span>
              <span className="font-mono">{tc.tool}</span>
              {tc.description && <span className="truncate">· {tc.description}</span>}
            </div>
          ))}
        </div>
      )}
      <div className="rounded-2xl rounded-bl-sm border border-border bg-bg-panel px-3.5 py-2.5">
        {m.text ? (
          <MarkdownView source={m.text} />
        ) : m.isStreaming ? (
          <span className="text-sm text-fg-subtle">pensando…</span>
        ) : null}
        {m.error && <p className="mt-2 text-xs text-danger">{m.error}</p>}
      </div>
      {m.text && !m.isStreaming && (
        <button
          type="button"
          onClick={() => onSpeak(m.text)}
          aria-label="Ouvir resposta"
          className="mt-1 inline-flex items-center gap-1 text-[11px] text-fg-subtle hover:text-fg-muted"
        >
          <Volume2 size={13} /> ouvir
        </button>
      )}
    </div>
  );
}
