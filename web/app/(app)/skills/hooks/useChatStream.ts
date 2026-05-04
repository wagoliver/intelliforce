"use client";

import { useCallback, useReducer, useRef } from "react";

import { chatReducer, initialChatState } from "../state/chatReducer";
import type { ChatAction } from "../state/types";

/**
 * Gera um ID único pra mensagens/tool calls da UI.
 *
 * `crypto.randomUUID()` exige contexto seguro (HTTPS ou localhost). Se a app
 * for acessada via IP da rede em HTTP (tipo http://192.168.0.10:3000), o
 * método não existe. Fallback usa Date.now + Math.random — não cripto-grado,
 * mas IDs aqui são só pra reconciliar mensagens no estado local.
 */
function genId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Lê eventos SSE do /api/proxy/chat/stream e despacha pro reducer.
 *
 * O backend manda cada evento NDJSON do OpenCode CLI como mensagem SSE
 * (`data: {...}\n\n`). Eventos sintéticos do nosso runner começam com `stream_`
 * pra não colidir com os do CLI.
 *
 * Mapping de event.type → action:
 *   - "text"                       → TEXT_DELTA (event.part.text)
 *   - "tool_use_start" / "tool"    → TOOL_CALL_STARTED
 *   - "tool_use_end"               → TOOL_CALL_FINISHED
 *   - "step_finish"                → ignorado (só pra métricas server-side)
 *   - "stream_start"               → AGENT_TURN_STARTED
 *   - "stream_end"                 → AGENT_TURN_FINISHED
 *   - "stream_error"               → ERROR
 *   - event.sessionID em qualquer  → SESSION_ID (só primeira vez)
 */
export function useChatStream() {
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (prompt: string, agent?: string) => {
      const trimmed = prompt.trim();
      if (!trimmed || state.isStreaming) return;

      const userId = genId();
      const agentId = genId();
      dispatch({ type: "USER_MESSAGE_SENT", id: userId, text: trimmed });

      // Aborta stream anterior caso ainda esteja em flight (paranoia, isStreaming já protege)
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const payload: Record<string, unknown> = {
        prompt: trimmed,
        session_id: state.sessionId,
      };
      if (agent) payload.agent = agent;

      let res: Response;
      try {
        res = await fetch("/api/proxy/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } catch (err) {
        dispatch({ type: "ERROR", error: err instanceof Error ? err.message : String(err) });
        return;
      }

      if (!res.ok || !res.body) {
        dispatch({ type: "ERROR", error: `HTTP ${res.status}` });
        return;
      }

      // Marca início do turno do agente (placeholder de mensagem)
      dispatch({ type: "AGENT_TURN_STARTED", id: agentId });

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let sessionEmitted = false;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // SSE: eventos separados por "\n\n"
          let sepIdx: number;
          while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
            const rawEvent = buffer.slice(0, sepIdx);
            buffer = buffer.slice(sepIdx + 2);

            // Parse SSE: pode ter múltiplas linhas "data:", ou ":" comentário (heartbeat)
            const dataLines: string[] = [];
            for (const line of rawEvent.split("\n")) {
              if (line.startsWith("data:")) {
                dataLines.push(line.slice(5).trimStart());
              }
              // ":" comentário → ignora
            }
            if (dataLines.length === 0) continue;

            const dataStr = dataLines.join("\n");
            let event: any;
            try {
              event = JSON.parse(dataStr);
            } catch {
              continue;
            }

            // Captura sessionID na primeira vez que aparecer
            if (!sessionEmitted && event?.sessionID) {
              dispatch({ type: "SESSION_ID", sessionId: event.sessionID });
              sessionEmitted = true;
            }

            const action = mapEventToAction(event);
            if (action) dispatch(action);
          }
        }
      } catch (err) {
        if ((err as any)?.name !== "AbortError") {
          dispatch({ type: "ERROR", error: err instanceof Error ? err.message : String(err) });
        }
      } finally {
        abortRef.current = null;
      }
    },
    [state.isStreaming, state.sessionId],
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  return { state, send, abort };
}

/**
 * Eventos puramente estruturais do CLI — não trazem informação útil pro user
 * e seriam só ruído se virassem thinking lines.
 */
const IGNORE_TYPES = new Set([
  "step_start",
  "step_finish",
  "assistant_message_start",
  "assistant_message_end",
  "session_start",
  "session_finish",
  "session_init",
  "session_end",
  "message_start",
  "message_end",
]);

// Tipos que indicam INÍCIO de tool call (variações de naming entre versões
// do OpenCode + Anthropic SDK)
const TOOL_START_TYPES = new Set([
  "tool_use_start",
  "tool_use",        // Anthropic API NDJSON: bloco solo "tool_use" começa a tool
  "tool_call",       // OpenAI-compat naming
  "tool",            // OpenCode older naming
  "tool_invocation",
]);

// Tipos que indicam FIM de tool call
const TOOL_END_TYPES = new Set([
  "tool_use_end",
  "tool_result",
  "tool_response",
]);

// Reasoning/thinking deltas — o Claude expõe esses quando "pensa em voz alta"
const REASONING_TYPES = new Set([
  "reasoning",
  "thinking",
  "thought",
  "reasoning_delta",
]);

/** Extrai um identificador estável da tool call (mesmo entre start e end). */
function extractToolId(event: any): string {
  const part = event?.part ?? {};
  return (
    part?.id ??
    part?.callID ??
    part?.toolUseID ??
    part?.tool_use_id ??
    event?.id ??
    event?.callID ??
    ""
  );
}

function mapEventToAction(event: any): ChatAction | null {
  const type: string = event?.type ?? "";

  // Debug em modo dev: loga TODOS os eventos do CLI no console pra
  // diagnóstico futuro. Setar window.__OPENCODE_DEBUG__ = true no console
  // do navegador (ou em qualquer lugar) ativa.
  if (typeof window !== "undefined" && (window as any).__OPENCODE_DEBUG__) {
    // eslint-disable-next-line no-console
    console.debug("[opencode]", type, event);
  }

  // Eventos sintéticos do runner
  if (type === "stream_start") {
    return null; // já tratado por AGENT_TURN_STARTED no send()
  }
  if (type === "stream_end") {
    return { type: "AGENT_TURN_FINISHED" };
  }
  if (type === "stream_error") {
    return { type: "ERROR", error: event?.error ?? "Erro desconhecido no stream" };
  }

  // Texto da resposta do agente
  if (type === "text") {
    const text = event?.part?.text ?? "";
    if (!text) return null;
    return { type: "TEXT_DELTA", text };
  }

  // Reasoning/thinking — dá visibilidade do "voz mental" do Claude
  if (REASONING_TYPES.has(type)) {
    const reasoning = event?.part?.text ?? event?.part?.thinking ?? event?.part?.reasoning ?? "";
    const txt = String(reasoning).trim();
    if (!txt) return null;
    return {
      type: "THINKING_LINE",
      id: genId(),
      kind: "reasoning",
      label: txt.slice(0, 200),
    };
  }

  // Tool calls — INÍCIO. Detecta por type OU por shape (presença de tool name).
  const looksLikeToolStart =
    TOOL_START_TYPES.has(type) ||
    (event?.part?.type && TOOL_START_TYPES.has(event.part.type)) ||
    // shape match: evento com `part.tool` ou `part.name` E sem result/error
    (event?.part &&
      typeof event.part === "object" &&
      (event.part.tool || event.part.name) &&
      event.part.input !== undefined &&
      event.part.output === undefined);

  if (looksLikeToolStart) {
    const part = event?.part ?? event ?? {};
    const tool = part?.tool ?? part?.name ?? type ?? "tool";
    const description = describeToolInput(part);
    const id = extractToolId(event) || genId();
    return { type: "TOOL_CALL_STARTED", id, tool: String(tool), description };
  }

  if (TOOL_END_TYPES.has(type)) {
    const id = extractToolId(event);
    if (!id) return null;
    const part = event?.part ?? event ?? {};
    const isError = part?.is_error ?? part?.error ?? false;
    return { type: "TOOL_CALL_FINISHED", id, status: isError ? "error" : "done" };
  }

  // Boundary events sem payload útil — descarta
  if (IGNORE_TYPES.has(type)) return null;

  // Qualquer outro evento vira "thinking line" — dá visibilidade do que o
  // agente está fazendo entre tool calls.
  const label = describeUnknownEvent(event);
  if (!label && !type) return null;
  return {
    type: "THINKING_LINE",
    id: genId(),
    kind: type || "event",
    label,
  };
}

/**
 * Extrai uma descrição curta de um evento NDJSON do CLI pra exibir como
 * "thinking line". Procura nos lugares mais prováveis de ter texto humano.
 */
function describeUnknownEvent(event: any): string {
  const part = event?.part ?? event ?? {};

  // Caso especial: evento traz nome de tool mas não casou com TOOL_START_TYPES.
  // Tenta inferir uma descrição combinando nome + input.
  if (part?.tool || part?.name) {
    const desc = describeToolInput(part);
    const tool = String(part?.tool ?? part?.name);
    return desc ? `${tool} · ${desc}` : tool;
  }

  const candidates = [
    part?.reasoning,
    part?.thought,
    part?.thinking,
    part?.message,
    part?.text,
    part?.content,
    part?.status,
    part?.label,
    typeof event?.error === "string" ? event.error : null,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) {
      return c.trim().slice(0, 200);
    }
  }
  return "";
}

/**
 * Descreve a invocação de um tool de forma legível, sem dump JSON gigante.
 * Mantém prioridade dos campos mais úteis pra cada tool conhecido.
 */
function describeToolInput(part: any): string {
  const tool = String(part?.tool ?? part?.name ?? "").toLowerCase();
  const input = part?.input ?? part?.params ?? {};
  if (typeof input === "string") return input.slice(0, 200);
  if (typeof input !== "object" || input === null) return "";

  // Bash: mostra o comando em si, truncado
  if (tool === "bash" && input.command) {
    return String(input.command).slice(0, 200);
  }

  // Write: path + tamanho do conteúdo (opcional)
  if (tool === "write" && (input.file_path || input.path)) {
    const path = String(input.file_path ?? input.path);
    const content = input.content ?? input.text ?? "";
    const len = typeof content === "string" ? content.length : 0;
    return len > 0 ? `${path}  ·  ${len} chars` : path;
  }

  // Read: path + range opcional
  if (tool === "read" && (input.file_path || input.path)) {
    const path = String(input.file_path ?? input.path);
    if (input.offset != null || input.limit != null) {
      return `${path}  (offset ${input.offset ?? 0}, limit ${input.limit ?? "—"})`;
    }
    return path;
  }

  // Edit: path
  if (tool === "edit" && (input.file_path || input.path)) {
    return String(input.file_path ?? input.path);
  }

  // Fallback genérico — pega primeiro campo string conhecido
  const fallback = input.command ?? input.path ?? input.file_path ?? input.url ?? "";
  return String(fallback).slice(0, 200);
}
