"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { AskForm, type AskQuestion } from "./components/AskForm";
import { EmptyState, PromptSuggestions } from "./components/EmptyState";
import { NeuralRibbons } from "./components/NeuralRibbons";
import { FileTree } from "./components/FileTree";
import { MarkdownView } from "./components/MarkdownView";
import { SkillDrawer } from "./components/SkillDrawer";
import { SlashPalette } from "./components/SlashPalette";
import { useChatStream } from "./hooks/useChatStream";
import { useOpenCodeTree, type OpenCodeFile, type OpenCodeTree } from "./hooks/useOpenCodeTree";
import { useReducedMotion } from "./hooks/useReducedMotion";
import { SLASH_COMMANDS, commandsForAgent, filterCommands, type SlashCommand } from "./state/slash-commands";
import type { ChatMessage, ThinkingLine, ToolCall } from "./state/types";

const SLIDE_UP = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

type AgentKey = "operator" | "builder";

const AGENT_OPTIONS: { key: AgentKey; label: string; tagline: string }[] = [
  { key: "operator", label: "Operator", tagline: "opera o sistema · cria deps, employees, agenda" },
  { key: "builder", label: "Builder", tagline: "constrói skills, agents, scripts" },
];

const AGENT_STORAGE_KEY = "skills.agent";

export default function SkillsPage() {
  const { state, send, abort } = useChatStream();
  const { tree, loading: treeLoading, error: treeError, refetch } = useOpenCodeTree();
  const [input, setInput] = useState("");
  const [selected, setSelected] = useState<{ kind: OpenCodeFile["kind"] | "script"; slug: string } | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [recentlyCreated, setRecentlyCreated] = useState<Set<string>>(new Set());
  const [agent, setAgent] = useState<AgentKey>("operator");

  // Hidrata seleção de agente do localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(AGENT_STORAGE_KEY);
    if (stored === "operator" || stored === "builder") setAgent(stored);
  }, []);

  // Persiste seleção
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(AGENT_STORAGE_KEY, agent);
  }, [agent]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const wasStreamingRef = useRef(false);
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTreeKeysRef = useRef<Set<string>>(new Set());
  const reducedMotion = useReducedMotion();

  // Slash palette — abre quando input começa com "/"
  const [slashIndex, setSlashIndex] = useState(0);
  const slashOpen = input.startsWith("/");
  const slashQuery = slashOpen ? input.slice(1).split(/\s/)[0] : "";
  const slashCommands = useMemo(() => {
    if (!slashOpen) return [];
    return filterCommands(commandsForAgent(agent), slashQuery);
  }, [slashOpen, slashQuery, agent]);

  // Reset highlighted ao mudar comandos disponíveis
  useEffect(() => {
    setSlashIndex(0);
  }, [slashQuery, agent]);

  function applySlashCommand(cmd: SlashCommand, params?: Record<string, string>) {
    let template = cmd.template;
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        template = template.replaceAll(`{${key}}`, value);
      }
    }
    setSlashIndex(0);

    // Se template ainda tem placeholder não-preenchido (ex: /dept-create {name}),
    // expande no input pro user editar antes de enviar.
    const hasUnfilledPlaceholder = /\{[^}]+\}/.test(template);
    if (hasUnfilledPlaceholder) {
      setInput(template);
      setTimeout(() => inputRef.current?.focus(), 0);
      return;
    }

    // Template completo — envia direto. Bolha do user mostra cmd.label
    // (ex: "/me"), backend recebe template expandido pra modelo entender.
    if (state.isStreaming) return;
    setInput("");
    void send(template, agent, cmd.label);
  }

  // Aplica slash command vindo via query param (ex: dashboard linkando "criar dept")
  const searchParams = useSearchParams();
  const appliedQueryRef = useRef(false);
  useEffect(() => {
    if (appliedQueryRef.current) return;
    const cmdSlug = searchParams.get("cmd");
    if (!cmdSlug) return;
    const command = SLASH_COMMANDS.find((c) => c.slug === cmdSlug);
    if (!command) return;

    // Força agente correto se o command exige um específico
    if (command.agents === "operator" && agent !== "operator") setAgent("operator");
    if (command.agents === "builder" && agent !== "builder") setAgent("builder");

    // Coleta params extras (ex: id) pra substituir placeholders no template
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      if (key !== "cmd") params[key] = value;
    });

    applySlashCommand(command, params);
    appliedQueryRef.current = true;

    // Limpa query params da URL sem reload (mantém estado React)
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.search = "";
      window.history.replaceState({}, "", url.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.messages]);

  // Auto-resize do textarea — cresce com o conteúdo até max-height (CSS).
  // Reset pra "auto" antes de medir scrollHeight (sem isso, height só cresce).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

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
    void send(value, agent);
    setInput("");
  }

  // Callbacks dos AskForms inline nas mensagens do agente
  function handleAskSubmit(answers: { id: string; label: string; value: string }[]) {
    if (state.isStreaming) return;
    const consolidated = answers.map((a) => `**${a.label}**: ${a.value}`).join("\n");
    void send(consolidated, agent);
  }
  function handleAskCancel() {
    if (state.isStreaming) return;
    void send(
      "Cancelei o questionário. Pode prosseguir sem essas informações ou vamos mudar de assunto.",
      agent,
    );
  }
  function handleAskFreeForm() {
    setTimeout(() => inputRef.current?.focus(), 0);
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
          onSelect={(item) => setSelected({ kind: item.kind, slug: item.slug })}
          onToggleCollapsed={() => setCollapsed((c) => !c)}
        />

        <main className="skills-main">
          {/* Fitas neurais ambiente — sempre presente, mais sutil quando há
              mensagens (não competir com texto). */}
          <NeuralRibbons dimmed={state.messages.length > 0 || state.isStreaming} />

          <header className="skills-header">
            <div className="skills-header-row">
              <div>
                <h1 className="skills-header-title">
                  <span className="skills-header-dot" aria-hidden="true" />
                  Command Center
                </h1>
                <span className="skills-header-sub">
                  {AGENT_OPTIONS.find((a) => a.key === agent)?.tagline ?? ""}
                </span>
              </div>
              <div className="skills-agent-switcher" role="tablist" aria-label="Selecionar agente">
                {AGENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    role="tab"
                    aria-selected={agent === opt.key}
                    className={`skills-agent-option ${agent === opt.key ? "skills-agent-option--active" : ""}`}
                    onClick={() => !state.isStreaming && setAgent(opt.key)}
                    disabled={state.isStreaming}
                    title={opt.tagline}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </header>

          {state.messages.length === 0 && !state.isStreaming ? (
            <EmptyState />
          ) : (
            <div ref={scrollRef} className="skills-chat" role="log" aria-live="polite" aria-atomic="false">
              <AnimatePresence initial={false}>
                {state.messages.map((m) => (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    reducedMotion={reducedMotion}
                    onAskSubmit={handleAskSubmit}
                    onAskCancel={handleAskCancel}
                    onAskFreeForm={handleAskFreeForm}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}

          {state.error && (
            <div role="alert" className="skills-error">
              {state.error}
            </div>
          )}

          {state.messages.length === 0 && !state.isStreaming && (
            <PromptSuggestions onSelect={(text) => onSubmit(text)} />
          )}

          <div className="skills-composer-wrapper">
            <SlashPalette
              open={slashOpen && slashCommands.length > 0 && !state.isStreaming}
              commands={slashCommands}
              highlightedIndex={Math.min(slashIndex, Math.max(0, slashCommands.length - 1))}
              onSelect={applySlashCommand}
              onHover={(i) => setSlashIndex(i)}
            />
            <div className="skills-composer">
              <div className="skills-composer-inner">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    // Slash palette ativo: setas/Enter/Esc cuidam do palette
                    if (slashOpen && slashCommands.length > 0) {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setSlashIndex((i) => (i + 1) % slashCommands.length);
                        return;
                      }
                      if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setSlashIndex((i) => (i - 1 + slashCommands.length) % slashCommands.length);
                        return;
                      }
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        const safeIdx = Math.min(slashIndex, slashCommands.length - 1);
                        applySlashCommand(slashCommands[safeIdx]);
                        return;
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setInput("");
                        return;
                      }
                      if (e.key === "Tab") {
                        e.preventDefault();
                        const safeIdx = Math.min(slashIndex, slashCommands.length - 1);
                        applySlashCommand(slashCommands[safeIdx]);
                        return;
                      }
                    }
                    // Enter envia · Shift+Enter quebra linha (deixa default do textarea)
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      onSubmit();
                    }
                  }}
                  placeholder={
                    state.isStreaming
                      ? "OpenCode trabalhando…"
                      : "O que você quer construir? (Enter envia · Shift+Enter quebra linha · / para comandos)"
                  }
                  disabled={state.isStreaming}
                  rows={1}
                  className="skills-composer-input"
                  aria-label="Mensagem para o OpenCode"
                />
              {state.isStreaming ? (
                <button
                  type="button"
                  onClick={abort}
                  className="skills-composer-button skills-composer-button--stop"
                  aria-label="Parar requisição em andamento"
                >
                  Parar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onSubmit()}
                  disabled={!input.trim()}
                  className="skills-composer-button"
                >
                  Enviar
                </button>
              )}
              </div>
            </div>
          </div>

          {state.sessionId && (
            <div className="skills-session">session: {state.sessionId}</div>
          )}
        </main>
      </div>

      <SkillDrawer
        selected={selected}
        onClose={() => setSelected(null)}
        onDeleted={() => {
          setSelected(null);
          void refetch();
        }}
      />
    </>
  );
}

type AgentPart =
  | { type: "markdown"; content: string }
  | { type: "ask"; questions: AskQuestion[] };

/**
 * Quebra texto da mensagem do agente em partes: markdown + blocos `ask`.
 *
 * Detecção tolerante: escaneia qualquer JSON array no texto (com ou sem
 * fence ```ask, ```json ou plain), valida se os itens têm shape de
 * question (id + label string), e trata como ask. Se o LLM esquecer a
 * fence, a heurística pega assim mesmo.
 *
 * Streaming: arrays incompletos não são detectados (bracket scanner falha
 * em achar `]` correspondente), então renderiza como markdown — quando o
 * streaming completar, o array fecha e vira form.
 */
function splitAgentMessage(source: string): AgentPart[] {
  type Range = { start: number; end: number; questions: AskQuestion[] };
  const ranges: Range[] = [];

  let i = 0;
  while (i < source.length) {
    if (source[i] === "[") {
      const closeIdx = findMatchingBracket(source, i);
      if (closeIdx > i) {
        const candidate = source.slice(i, closeIdx + 1);
        try {
          const parsed = JSON.parse(candidate);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(isAskQuestion)) {
            ranges.push({ start: i, end: closeIdx + 1, questions: parsed as AskQuestion[] });
            i = closeIdx + 1;
            continue;
          }
        } catch {
          /* não é JSON válido, segue scan */
        }
      }
    }
    i++;
  }

  if (ranges.length === 0) return [{ type: "markdown", content: source }];

  const parts: AgentPart[] = [];
  let cursor = 0;
  for (const r of ranges) {
    if (r.start > cursor) {
      // Pré-texto: remove fence aberta imediatamente antes (```ask\n, ```json\n, ```\n)
      let pre = source.slice(cursor, r.start);
      pre = pre.replace(/```[a-zA-Z]*\s*\n?\s*$/u, "");
      if (pre.trim().length > 0) parts.push({ type: "markdown", content: pre });
    }
    parts.push({ type: "ask", questions: r.questions });
    cursor = r.end;
    // Pula fence de fechamento imediatamente após (\n``` ou ``` no final)
    const after = source.slice(cursor);
    const closeMatch = after.match(/^\s*```\s*\n?/u);
    if (closeMatch) cursor += closeMatch[0].length;
  }
  if (cursor < source.length) {
    const tail = source.slice(cursor);
    if (tail.trim().length > 0) parts.push({ type: "markdown", content: tail });
  }
  return parts;
}

function findMatchingBracket(source: string, start: number): number {
  let depth = 1;
  let i = start + 1;
  let inString = false;
  let escape = false;
  while (i < source.length) {
    const c = source[i];
    if (inString) {
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === '"') inString = false;
    } else {
      if (c === '"') inString = true;
      else if (c === "[") depth++;
      else if (c === "]") {
        depth--;
        if (depth === 0) return i;
      }
    }
    i++;
  }
  return -1;
}

function isAskQuestion(o: unknown): boolean {
  if (!o || typeof o !== "object") return false;
  const r = o as Record<string, unknown>;
  return typeof r.id === "string" && typeof r.label === "string";
}

function MessageBubble({
  message,
  reducedMotion,
  onAskSubmit,
  onAskCancel,
  onAskFreeForm,
}: {
  message: ChatMessage;
  reducedMotion: boolean;
  onAskSubmit: (a: { id: string; label: string; value: string }[]) => void;
  onAskCancel: () => void;
  onAskFreeForm: () => void;
}) {
  const isUser = message.role === "user";
  const agentParts = !isUser && message.text ? splitAgentMessage(message.text) : null;
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (isUser || !message.text) return;
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* user pode selecionar manual */
    }
  }

  return (
    <motion.div
      className={`skills-bubble ${isUser ? "skills-bubble--user" : "skills-bubble--agent"}`}
      variants={SLIDE_UP}
      initial={reducedMotion ? "visible" : "hidden"}
      animate="visible"
      transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.34, 1.56, 0.64, 1] }}
    >
      <span className="skills-bubble-role">
        {isUser ? "você" : "opencode"}
        {!isUser && message.role === "agent" && (
          <LiveClock
            startedAt={message.startedAt}
            finishedAt={message.finishedAt}
          />
        )}
      </span>

      {!isUser && message.role === "agent" && message.isStreaming && (
        <LiveStatus message={message} reducedMotion={reducedMotion} />
      )}

      {!isUser && message.role === "agent" && (
        (() => {
          const reasoningLines = message.thinkingLines.filter((tl) => tl.kind === "reasoning");
          const otherLines = message.thinkingLines.filter((tl) => tl.kind !== "reasoning");
          const hasContent =
            message.toolCalls.length > 0 ||
            otherLines.length > 0 ||
            reasoningLines.length > 0;
          if (!hasContent) return null;
          return (
            <div className="skills-process">
              <AnimatePresence initial={false}>
                {message.toolCalls.map((tc, i) => (
                  <ToolCallLine key={`tool-${tc.id}`} call={tc} index={i} reducedMotion={reducedMotion} />
                ))}
                {otherLines.map((tl, i) => (
                  <ThinkingLineRow
                    key={`think-${tl.id}`}
                    line={tl}
                    index={i + message.toolCalls.length}
                    reducedMotion={reducedMotion}
                  />
                ))}
              </AnimatePresence>
              {reasoningLines.length > 0 && (
                <ReasoningStream
                  lines={reasoningLines}
                  isStreaming={message.isStreaming}
                  reducedMotion={reducedMotion}
                />
              )}
            </div>
          );
        })()
      )}

      {isUser && message.text && (
        <div className="skills-bubble-text">{message.text}</div>
      )}

      {!isUser && agentParts?.map((p, i) =>
        p.type === "markdown" ? (
          <MarkdownView key={i} source={p.content} variant="bubble" />
        ) : (
          <AskForm
            key={i}
            questions={p.questions}
            onSubmit={onAskSubmit}
            onCancel={onAskCancel}
            onSwitchToFreeForm={onAskFreeForm}
          />
        ),
      )}

      {!isUser && message.role === "agent" && !message.isStreaming && message.text && (
        <div className="skills-bubble-actions" aria-label="Ações da resposta">
          <button
            type="button"
            className="skills-bubble-action"
            onClick={handleCopy}
            title={copied ? "Copiado!" : "Copiar resposta"}
          >
            {copied ? (
              <svg width={12} height={12} viewBox="0 0 16 16" aria-hidden="true">
                <path
                  d="M3.5 8.5l3 3 6-6"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            ) : (
              <svg width={12} height={12} viewBox="0 0 16 16" aria-hidden="true">
                <rect x="4" y="4" width="8" height="9" rx="1.2" stroke="currentColor" strokeWidth="1.4" fill="none" />
                <path d="M6 4V3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-1" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
              </svg>
            )}
            <span>{copied ? "Copiado" : "Copiar"}</span>
          </button>
        </div>
      )}

      {!isUser && message.error && (
        <div className="skills-bubble-cancelled">{message.error}</div>
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
      <span className="skills-toolcall-tool">{prettyToolName(call.tool)}</span>
      {call.description && <span className="skills-toolcall-desc">{call.description}</span>}
      <LiveClock startedAt={call.startedAt} finishedAt={call.finishedAt} />
    </motion.div>
  );
}

function formatElapsed(ms: number): string {
  const s = Math.max(0, ms) / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const min = Math.floor(s / 60);
  const rem = s - min * 60;
  return `${min}m ${rem.toFixed(0)}s`;
}

/**
 * Capitaliza o nome do tool pra display (bash → Bash, todoread → TodoRead).
 * Lookup explícito pra alguns casos comuns; default = capitalize first letter.
 */
const TOOL_NAME_PRETTY: Record<string, string> = {
  bash: "Bash",
  read: "Read",
  write: "Write",
  edit: "Edit",
  glob: "Glob",
  grep: "Grep",
  webfetch: "WebFetch",
  fetch: "Fetch",
  task: "Task",
  agent: "Agent",
  skill: "Skill",
  todoread: "TodoRead",
  todowrite: "TodoWrite",
  multiedit: "MultiEdit",
  notebookedit: "NotebookEdit",
};
function prettyToolName(tool: string): string {
  if (!tool) return "tool";
  const k = tool.toLowerCase();
  return TOOL_NAME_PRETTY[k] ?? (k.charAt(0).toUpperCase() + k.slice(1));
}

/**
 * Cronômetro vivo: incrementa a cada 100ms enquanto streaming, congela em
 * `finishedAt - startedAt` quando turn termina. Sempre visível na bolha do
 * agente — mostra também o tempo total das mensagens já concluídas.
 */
function LiveClock({
  startedAt,
  finishedAt,
}: {
  startedAt: number;
  finishedAt: number | null;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (finishedAt !== null) {
      // Congela exatamente em finishedAt
      setNow(finishedAt);
      return;
    }
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [finishedAt]);

  const elapsed = (finishedAt ?? now) - startedAt;
  return <span className="skills-live-clock">{formatElapsed(elapsed)}</span>;
}

/**
 * Status em destaque dentro do bubble enquanto agente está streaming.
 * Mostra a atividade corrente — antes do primeiro evento, "OpenCode está
 * pensando…"; quando uma tool roda, "Bash · vault.py list"; quando texto
 * começa a streamar, troca pra "Gerando resposta…".
 *
 * Some quando turn termina (parent só renderiza enquanto isStreaming).
 */
function LiveStatus({
  message,
  reducedMotion,
}: {
  message: Extract<ChatMessage, { role: "agent" }>;
  reducedMotion: boolean;
}) {
  const runningTools = message.toolCalls.filter((tc) => tc.status === "running");
  const lastRunningTool = runningTools[runningTools.length - 1];
  const lastThinking = message.thinkingLines[message.thinkingLines.length - 1];
  const hasText = message.text.length > 0;

  // Linha 1 (sempre presente enquanto streaming): estado geral
  let label: string;
  let kind: "thinking" | "tool" | "reasoning" | "writing";

  if (hasText && lastRunningTool) {
    // Texto streaming + tool em paralelo: prioridade visual ao tool
    // (texto já é visível na bolha, então o status mostra o que NÃO é óbvio)
    const desc = lastRunningTool.description ? ` · ${lastRunningTool.description}` : "";
    label = `${prettyToolName(lastRunningTool.tool)}${desc}`;
    kind = "tool";
  } else if (hasText) {
    label = "Gerando resposta…";
    kind = "writing";
  } else if (lastRunningTool) {
    const desc = lastRunningTool.description ? ` · ${lastRunningTool.description}` : "";
    label = `${prettyToolName(lastRunningTool.tool)}${desc}`;
    kind = "tool";
  } else if (lastThinking?.label) {
    label = lastThinking.label;
    kind = "reasoning";
  } else {
    label = "OpenCode está pensando…";
    kind = "thinking";
  }

  return (
    <motion.div
      key={kind + label.slice(0, 20)}
      className={`skills-live-status skills-live-status--${kind}`}
      initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: -2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.18 }}
      aria-live="polite"
    >
      <LiveSpinner reducedMotion={reducedMotion} />
      <motion.span
        key={label}                  /* re-anima quando a label troca */
        className="skills-live-label"
        initial={reducedMotion ? { opacity: 1 } : { opacity: 0, x: 4 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.16, ease: "easeOut" }}
      >
        {label}
      </motion.span>
      {lastRunningTool && (
        <LiveClock startedAt={lastRunningTool.startedAt} finishedAt={null} />
      )}
      {runningTools.length > 1 && (
        <span className="skills-live-extra-count" title="Outras tools em paralelo">
          +{runningTools.length - 1}
        </span>
      )}
    </motion.div>
  );
}

/**
 * Spinner SVG circular sempre rodando enquanto LiveStatus está montado.
 * Substitui o pulse-dot anterior. Cor herdada do --skills-live-status--<kind>
 * variant via currentColor.
 */
function LiveSpinner({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <svg
      className="skills-live-spinner"
      viewBox="0 0 16 16"
      width={14}
      height={14}
      aria-hidden="true"
      style={reducedMotion ? { animation: "none", opacity: 0.7 } : undefined}
    >
      <circle
        cx="8" cy="8" r="6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeOpacity="0.25"
      />
      <path
        d="M 8 2 A 6 6 0 0 1 14 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Stream de reasoning chunks com efeito de fila — mostra os 5 mais recentes.
 *
 * Durante streaming:
 *   - Limita a 5 linhas visíveis
 *   - Linha mais antiga (topo) tem opacity baixa (~0.2), mais nova (base) tem 1.0
 *   - Quando chega chunk novo, antigas deslizam pra cima e somem (framer-motion
 *     layout="position" cuida do movimento)
 *
 * Após streaming terminar:
 *   - Colapsa automaticamente em "💭 ver pensamento (N chunks)"
 *   - Click expande lista completa (todos os chunks com fullText)
 */
function ReasoningStream({
  lines,
  isStreaming,
  reducedMotion,
}: {
  lines: ThinkingLine[];
  isStreaming: boolean;
  reducedMotion: boolean;
}) {
  const [expandedAfterFinish, setExpandedAfterFinish] = useState(false);

  // Durante streaming: mostra os 5 mais recentes com fila + alpha
  if (isStreaming) {
    const visible = lines.slice(-5); // 5 mais recentes
    const total = visible.length;
    return (
      <div className="skills-reasoning-stream" aria-live="polite">
        <AnimatePresence initial={false} mode="popLayout">
          {visible.map((tl, idx) => {
            // idx 0 = mais antiga visível (topo), idx total-1 = mais nova (base).
            // Alpha cresce com idx.
            const alpha = total === 1 ? 1 : 0.2 + 0.8 * (idx / (total - 1));
            return (
              <motion.div
                key={tl.id}
                layout="position"
                className="skills-reasoning-line"
                initial={
                  reducedMotion
                    ? { opacity: alpha, y: 0 }
                    : { opacity: 0, y: 12 }
                }
                animate={{ opacity: alpha, y: 0 }}
                exit={
                  reducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: -12, height: 0, marginTop: 0, marginBottom: 0 }
                }
                transition={{
                  duration: reducedMotion ? 0 : 0.28,
                  ease: [0.32, 0.72, 0, 1],
                }}
              >
                <span className="skills-reasoning-kind">reasoning</span>
                <span className="skills-reasoning-label">{tl.label}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    );
  }

  // Após terminar: bloco colapsável
  return (
    <div className="skills-reasoning-collapsed">
      <button
        type="button"
        className="skills-reasoning-toggle"
        onClick={() => setExpandedAfterFinish((v) => !v)}
        aria-expanded={expandedAfterFinish}
      >
        <span className="skills-reasoning-toggle-icon" aria-hidden="true">
          {expandedAfterFinish ? "▾" : "▸"}
        </span>
        <span className="skills-reasoning-toggle-label">
          💭 {lines.length === 1
            ? "Ver pensamento (1 chunk)"
            : `Ver pensamento (${lines.length} chunks)`}
        </span>
      </button>
      {expandedAfterFinish && (
        <motion.div
          className="skills-reasoning-expanded"
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: reducedMotion ? 0 : 0.22 }}
        >
          {lines.map((tl) => (
            <div key={tl.id} className="skills-reasoning-line skills-reasoning-line--full">
              <span className="skills-reasoning-kind">reasoning</span>
              <span className="skills-reasoning-label">
                {tl.fullText || tl.label}
              </span>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

function ThinkingLineRow({
  line,
  index,
  reducedMotion,
}: {
  line: ThinkingLine;
  index: number;
  reducedMotion: boolean;
}) {
  const isReasoning = /reasoning|thought|thinking/i.test(line.kind);
  const cls = isReasoning ? "skills-thinking-line skills-thinking-line--reasoning" : "skills-thinking-line";
  return (
    <motion.div
      className={cls}
      initial={reducedMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: reducedMotion ? 0 : 0.18,
        delay: reducedMotion ? 0 : Math.min(index * 0.03, 0.3),
        ease: [0.32, 0.72, 0, 1],
      }}
    >
      <span className="skills-thinking-line-icon" aria-hidden="true">·</span>
      <span className="skills-thinking-line-kind">{line.kind}</span>
      {line.label && <span className="skills-thinking-line-label">{line.label}</span>}
    </motion.div>
  );
}

function collectKeys(tree: OpenCodeTree): Set<string> {
  const keys = new Set<string>();
  tree.skills.forEach((s) => keys.add(`skill/${s.slug}`));
  tree.agents.forEach((a) => keys.add(`agent/${a.slug}`));
  tree.commands.forEach((c) => keys.add(`command/${c.slug}`));
  tree.scripts.forEach((s) => keys.add(`script/${s.slug}`));
  return keys;
}
