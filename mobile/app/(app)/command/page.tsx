"use client";

import { Send, Square, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { MarkdownView } from "@/components/chat/MarkdownView";
import { MicButton } from "@/components/chat/MicButton";
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
  const [text, setText] = useState("");
  const [agent, setAgent] = useState<string>("operator");
  const bottomRef = useRef<HTMLDivElement>(null);
  const voiceReplyRef = useRef(false);
  const prevStreaming = useRef(false);

  const { supported, listening, speaking, interim, error, start, stop, speak, cancelSpeak } =
    useVoice({
      lang: "pt-BR",
      onFinal: (t) => {
        voiceReplyRef.current = true; // resposta deste turno deve ser falada
        void send(t, agent);
      },
    });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [state.messages, state.isStreaming, interim]);

  // Quando um turno iniciado por voz termina, fala a resposta do agente.
  useEffect(() => {
    const was = prevStreaming.current;
    prevStreaming.current = state.isStreaming;
    if (was && !state.isStreaming && voiceReplyRef.current) {
      voiceReplyRef.current = false;
      const lastAgent = [...state.messages].reverse().find((m) => m.role === "agent");
      if (lastAgent && lastAgent.role === "agent" && lastAgent.text) {
        speak(stripMarkdown(lastAgent.text));
      }
    }
  }, [state.isStreaming, state.messages, speak]);

  function submit() {
    const t = text.trim();
    if (!t || state.isStreaming) return;
    voiceReplyRef.current = false; // enviado por texto → não fala a resposta
    void send(t, agent);
    setText("");
  }

  const micDisabled = state.isStreaming || speaking;

  return (
    <>
      {state.messages.length === 0 ? (
        <div className="panel mt-6 flex flex-col gap-2 p-6 text-center">
          <p className="font-display text-base font-semibold text-fg">Centro de Comando</p>
          <p className="text-sm text-fg-muted">
            Converse com o <strong>Operador</strong> pra agir no sistema, ou com o{" "}
            <strong>Construtor</strong> pra criar capacidades. Escreva
            {supported ? " ou segure o microfone " : " "}abaixo.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 pb-[128px]">
          {state.messages.map((m) => (
            <MessageBubble key={m.id} m={m} />
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Composer fixo acima da bottom nav */}
      <div
        className="fixed inset-x-0 z-20 border-t border-border bg-bg-panel/95 px-3 pt-2 backdrop-blur"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 58px)" }}
      >
        {/* Banners de voz */}
        {listening && (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-danger/10 px-3 py-1.5 text-xs text-danger">
            <span className="h-2 w-2 animate-pulse rounded-full bg-danger" />
            <span className="truncate">{interim || "Ouvindo…"}</span>
          </div>
        )}
        {speaking && !listening && (
          <button
            type="button"
            onClick={cancelSpeak}
            className="mb-2 flex w-full items-center gap-2 rounded-lg bg-accent/10 px-3 py-1.5 text-xs text-accent"
          >
            <Volume2 size={14} /> Falando… toque para parar
          </button>
        )}
        {error === "permission" && (
          <div className="mb-2 rounded-lg bg-warning/10 px-3 py-1.5 text-xs text-warning">
            Permissão de microfone negada.
          </div>
        )}

        <div className="mb-2 flex gap-1.5">
          {AGENTS.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => setAgent(a.key)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                agent === a.key ? "bg-accent text-white" : "bg-bg-subtle text-fg-muted"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>

        <div className="flex items-end gap-2 pb-2">
          {supported && (
            <MicButton
              listening={listening}
              disabled={micDisabled}
              onStart={start}
              onStop={stop}
            />
          )}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder={supported ? "Digite ou segure o mic…" : "Digite um comando…"}
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
              onClick={submit}
              disabled={!text.trim()}
              aria-label="Enviar"
              className="btn-primary !px-3"
            >
              <Send size={18} />
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function MessageBubble({ m }: { m: ChatMessage }) {
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
    </div>
  );
}
