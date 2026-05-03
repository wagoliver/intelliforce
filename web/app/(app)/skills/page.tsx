"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import { EmptyState } from "./components/EmptyState";
import { FileTree } from "./components/FileTree";
import { SkillDrawer } from "./components/SkillDrawer";
import { useChatStream } from "./hooks/useChatStream";
import { useOpenCodeTree, type OpenCodeFile, type OpenCodeTree } from "./hooks/useOpenCodeTree";
import { useReducedMotion } from "./hooks/useReducedMotion";
import type { ChatMessage, ToolCall } from "./state/types";

const SLIDE_UP = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

export default function SkillsPage() {
  const { state, send } = useChatStream();
  const { tree, loading: treeLoading, error: treeError, refetch } = useOpenCodeTree();
  const [input, setInput] = useState("");
  const [selected, setSelected] = useState<{ kind: OpenCodeFile["kind"]; slug: string } | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [recentlyCreated, setRecentlyCreated] = useState<Set<string>>(new Set());

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const wasStreamingRef = useRef(false);
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTreeKeysRef = useRef<Set<string>>(new Set());
  const reducedMotion = useReducedMotion();

  // auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.messages]);

  // Refetch tree quando stream termina
  useEffect(() => {
    if (wasStreamingRef.current && !state.isStreaming) {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
      refetchTimerRef.current = setTimeout(() => void refetch(), 300);
    }
    wasStreamingRef.current = state.isStreaming;
    return () => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    };
  }, [state.isStreaming, refetch]);

  // Detecta arquivos novos pra animar glow na tree
  useEffect(() => {
    const currentKeys = collectKeys(tree);
    const prev = prevTreeKeysRef.current;

    // Se primeiro carregamento (prev vazio), só registra sem animar
    if (prev.size === 0) {
      prevTreeKeysRef.current = currentKeys;
      return;
    }

    const newKeys = new Set<string>();
    currentKeys.forEach((k) => {
      if (!prev.has(k)) newKeys.add(k);
    });

    if (newKeys.size > 0) {
      setRecentlyCreated((set) => {
        const next = new Set(set);
        newKeys.forEach((k) => next.add(k));
        return next;
      });
      // Remove após animação
      setTimeout(() => {
        setRecentlyCreated((set) => {
          const next = new Set(set);
          newKeys.forEach((k) => next.delete(k));
          return next;
        });
      }, 1700);
    }

    prevTreeKeysRef.current = currentKeys;
  }, [tree]);

  function onSubmit(text?: string) {
    const value = (text ?? input).trim();
    if (!value || state.isStreaming) return;
    void send(value);
    setInput("");
  }

  return (
    <>
      <div className="skills-content">
        <FileTree
          tree={tree}
          loading={treeLoading}
          error={treeError}
          selected={selected}
          collapsed={collapsed}
          recentlyCreated={recentlyCreated}
          onSelect={(f) => setSelected({ kind: f.kind, slug: f.slug })}
          onToggleCollapsed={() => setCollapsed((c) => !c)}
        />

        <main className="skills-main">
          <header className="skills-header">
            <h1 className="skills-header-title">
              <span className="skills-header-dot" aria-hidden="true" />
              Skill Studio
            </h1>
            <span className="skills-header-sub">
              chat com OpenCode · agente builder · streaming em tempo real
            </span>
          </header>

          {state.messages.length === 0 && !state.isStreaming ? (
            <EmptyState onSuggestion={(text) => onSubmit(text)} />
          ) : (
            <div ref={scrollRef} className="skills-chat" role="log" aria-live="polite" aria-atomic="false">
              <AnimatePresence initial={false}>
                {state.messages.map((m) => (
                  <MessageBubble key={m.id} message={m} reducedMotion={reducedMotion} />
                ))}
              </AnimatePresence>
              {state.isStreaming && <div className="skills-thinking">OpenCode está pensando…</div>}
            </div>
          )}

          {state.error && (
            <div role="alert" className="skills-error">
              {state.error}
            </div>
          )}

          <div className="skills-composer">
            <div className="skills-composer-inner">
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
                className="skills-composer-input"
                aria-label="Mensagem para o OpenCode"
              />
              <button
                type="button"
                onClick={() => onSubmit()}
                disabled={state.isStreaming || !input.trim()}
                className="skills-composer-button"
              >
                Enviar
              </button>
            </div>
          </div>

          {state.sessionId && (
            <div className="skills-session">session: {state.sessionId}</div>
          )}
        </main>
      </div>

      <SkillDrawer selected={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function MessageBubble({ message, reducedMotion }: { message: ChatMessage; reducedMotion: boolean }) {
  const isUser = message.role === "user";
  return (
    <motion.div
      className={`skills-bubble ${isUser ? "skills-bubble--user" : "skills-bubble--agent"}`}
      variants={SLIDE_UP}
      initial={reducedMotion ? "visible" : "hidden"}
      animate="visible"
      transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.34, 1.56, 0.64, 1] }}
    >
      <span className="skills-bubble-role">{isUser ? "você" : "opencode"}</span>
      {!isUser && message.toolCalls.length > 0 && (
        <div className="skills-toolcalls">
          <AnimatePresence initial={false}>
            {message.toolCalls.map((tc, i) => (
              <ToolCallLine key={tc.id} call={tc} index={i} reducedMotion={reducedMotion} />
            ))}
          </AnimatePresence>
        </div>
      )}
      {message.text && <div className="skills-bubble-text">{message.text}</div>}
      {!isUser && message.error && (
        <div style={{ fontSize: 11.5, color: "var(--danger)" }}>{message.error}</div>
      )}
    </motion.div>
  );
}

function ToolCallLine({
  call,
  index,
  reducedMotion,
}: {
  call: ToolCall;
  index: number;
  reducedMotion: boolean;
}) {
  return (
    <motion.div
      className={`skills-toolcall skills-toolcall--${call.status}`}
      initial={reducedMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: reducedMotion ? 0 : 0.22,
        delay: reducedMotion ? 0 : Math.min(index * 0.05, 0.4),
        ease: [0.32, 0.72, 0, 1],
      }}
    >
      <span className="skills-toolcall-icon" aria-hidden="true">
        {call.status === "running" ? "" : call.status === "done" ? "✓" : "✕"}
      </span>
      <span className="skills-toolcall-tool">{call.tool}</span>
      {call.description && <span className="skills-toolcall-desc">{call.description}</span>}
    </motion.div>
  );
}

function collectKeys(tree: OpenCodeTree): Set<string> {
  const keys = new Set<string>();
  tree.skills.forEach((s) => keys.add(`skill/${s.slug}`));
  tree.agents.forEach((a) => keys.add(`agent/${a.slug}`));
  tree.commands.forEach((c) => keys.add(`command/${c.slug}`));
  return keys;
}
