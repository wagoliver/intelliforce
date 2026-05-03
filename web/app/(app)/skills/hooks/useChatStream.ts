"use client";

import { useCallback, useReducer, useRef } from "react";

import { chatReducer, initialChatState } from "../state/chatReducer";
import type { ChatAction } from "../state/types";

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
    async (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed || state.isStreaming) return;

      const userId = crypto.randomUUID();
      const agentId = crypto.randomUUID();
      dispatch({ type: "USER_MESSAGE_SENT", id: userId, text: trimmed });

      // Aborta stream anterior caso ainda esteja em flight (paranoia, isStreaming já protege)
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      let res: Response;
      try {
        res = await fetch("/api/proxy/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: trimmed, session_id: state.sessionId }),
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

function mapEventToAction(event: any): ChatAction | null {
  const type: string = event?.type ?? "";

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

  // Eventos do CLI OpenCode
  if (type === "text") {
    const text = event?.part?.text ?? "";
    if (!text) return null;
    return { type: "TEXT_DELTA", text };
  }

  // Tool calls — naming exato do OpenCode pode variar; lidamos com formas comuns
  if (type === "tool_use_start" || type === "tool" || type === "tool_call") {
    const part = event?.part ?? event ?? {};
    const tool = part?.tool ?? part?.name ?? "tool";
    const description = describeToolInput(part);
    const id = part?.id ?? part?.callID ?? crypto.randomUUID();
    return { type: "TOOL_CALL_STARTED", id, tool, description };
  }
  if (type === "tool_use_end" || type === "tool_result") {
    const part = event?.part ?? event ?? {};
    const id = part?.id ?? part?.callID ?? "";
    if (!id) return null;
    const isError = part?.is_error ?? part?.error ?? false;
    return { type: "TOOL_CALL_FINISHED", id, status: isError ? "error" : "done" };
  }

  return null;
}

function describeToolInput(part: any): string {
  const input = part?.input ?? part?.params ?? {};
  if (typeof input === "string") return input.slice(0, 120);
  if (input?.command) return String(input.command).slice(0, 120);
  if (input?.path) return String(input.path).slice(0, 120);
  if (input?.file_path) return String(input.file_path).slice(0, 120);
  return "";
}
