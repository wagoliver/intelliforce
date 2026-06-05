// COPIADO DE web/app/(app)/skills/hooks/useChatStream.ts — manter em sincronia
"use client";

import { useCallback, useReducer, useRef } from "react";

import { chatReducer, initialChatState } from "../state/chatReducer";
import type { ChatAction, ChatMessage } from "../state/types";

export type HistoryMessage = {
  id: string;
  role: "user" | "agent";
  content: string;
  sequence_num: number;
  created_at: string;
};

function genId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

export function useChatStream() {
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (prompt: string, agent?: string, displayText?: string) => {
      const trimmed = prompt.trim();
      if (!trimmed || state.isStreaming) return;

      const userId = genId();
      const agentId = genId();
      dispatch({
        type: "USER_MESSAGE_SENT",
        id: userId,
        text: (displayText ?? trimmed).trim(),
      });

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

          let sepIdx: number;
          while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
            const rawEvent = buffer.slice(0, sepIdx);
            buffer = buffer.slice(sepIdx + 2);

            const dataLines: string[] = [];
            for (const line of rawEvent.split("\n")) {
              if (line.startsWith("data:")) {
                dataLines.push(line.slice(5).trimStart());
              }
            }
            if (dataLines.length === 0) continue;

            const dataStr = dataLines.join("\n");
            let event: any;
            try {
              event = JSON.parse(dataStr);
            } catch {
              continue;
            }

            if (!sessionEmitted && event?.sessionID) {
              dispatch({ type: "SESSION_ID", sessionId: event.sessionID });
              sessionEmitted = true;
            }

            const result = mapEventToAction(event);
            if (Array.isArray(result)) {
              for (const a of result) dispatch(a);
            } else if (result) {
              dispatch(result);
            }
          }
        }
      } catch (err) {
        if ((err as any)?.name !== "AbortError") {
          dispatch({ type: "ERROR", error: err instanceof Error ? err.message : String(err) });
        } else {
          dispatch({ type: "AGENT_TURN_FINISHED" });
        }
      } finally {
        abortRef.current = null;
        dispatch({ type: "AGENT_TURN_FINISHED" });
      }
    },
    [state.isStreaming, state.sessionId],
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    dispatch({ type: "AGENT_TURN_FINISHED" });
  }, []);

  const hydrateFromHistory = useCallback(
    (opencodeSessionId: string, history: HistoryMessage[]) => {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      const messages: ChatMessage[] = history.map((m) => {
        if (m.role === "user") {
          return { id: m.id, role: "user", text: m.content };
        }
        const ts = Date.parse(m.created_at) || Date.now();
        return {
          id: m.id,
          role: "agent",
          text: m.content,
          toolCalls: [],
          thinkingLines: [],
          isStreaming: false,
          startedAt: ts,
          finishedAt: ts,
        };
      });
      dispatch({
        type: "HYDRATE_FROM_HISTORY",
        messages,
        sessionId: opencodeSessionId,
      });
    },
    [],
  );

  const reset = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    dispatch({ type: "RESET_CHAT" });
  }, []);

  return { state, send, abort, hydrateFromHistory, reset };
}

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

const TOOL_START_TYPES = new Set([
  "tool_use_start",
  "tool_use",
  "tool_call",
  "tool",
  "tool_invocation",
]);

const TOOL_END_TYPES = new Set([
  "tool_use_end",
  "tool_result",
  "tool_response",
]);

const REASONING_TYPES = new Set([
  "reasoning",
  "thinking",
  "thought",
  "reasoning_delta",
]);

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

function mapEventToAction(event: any): ChatAction | ChatAction[] | null {
  const type: string = event?.type ?? "";

  if (typeof window !== "undefined" && (window as any).__OPENCODE_DEBUG__) {
    // eslint-disable-next-line no-console
    console.debug("[opencode]", type, event);
  }

  if (type === "stream_start") {
    return null;
  }
  if (type === "stream_end") {
    return { type: "AGENT_TURN_FINISHED" };
  }
  if (type === "stream_error") {
    return { type: "ERROR", error: event?.error ?? "Erro desconhecido no stream" };
  }

  if (type === "text") {
    const text = event?.part?.text ?? "";
    if (!text) return null;
    return { type: "TEXT_DELTA", text };
  }

  if (REASONING_TYPES.has(type)) {
    const reasoning = event?.part?.text ?? event?.part?.thinking ?? event?.part?.reasoning ?? "";
    const txt = String(reasoning).trim();
    if (!txt) return null;
    return {
      type: "THINKING_LINE",
      id: genId(),
      kind: "reasoning",
      label: txt.slice(0, 200),
      fullText: txt,
    };
  }

  const looksLikeToolEvent =
    TOOL_START_TYPES.has(type) ||
    TOOL_END_TYPES.has(type) ||
    (event?.part?.type && (
      TOOL_START_TYPES.has(event.part.type) ||
      event.part.type === "tool"
    )) ||
    (event?.part &&
      typeof event.part === "object" &&
      (event.part.tool || event.part.name));

  if (looksLikeToolEvent) {
    const part = event?.part ?? event ?? {};
    const tool = part?.tool ?? part?.name ?? type ?? "tool";
    const description = describeToolInput(part);
    const id = extractToolId(event) || genId();

    const status = part?.state?.status ?? part?.status;
    const isExplicitEnd = TOOL_END_TYPES.has(type);
    const isExplicitError =
      status === "error" || part?.is_error || part?.error === true;

    if (status === "completed" || isExplicitEnd || isExplicitError) {
      return [
        { type: "TOOL_CALL_STARTED", id, tool: String(tool), description },
        {
          type: "TOOL_CALL_FINISHED",
          id,
          status: isExplicitError ? "error" : "done",
        },
      ];
    }

    return { type: "TOOL_CALL_STARTED", id, tool: String(tool), description };
  }

  if (IGNORE_TYPES.has(type)) return null;

  const label = describeUnknownEvent(event);
  if (!label && !type) return null;
  return {
    type: "THINKING_LINE",
    id: genId(),
    kind: type || "event",
    label,
  };
}

function describeUnknownEvent(event: any): string {
  const part = event?.part ?? event ?? {};

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

function describeToolInput(part: any): string {
  const tool = String(part?.tool ?? part?.name ?? "").toLowerCase();
  const input =
    part?.state?.input ??
    part?.input ??
    part?.params ??
    part?.arguments ??
    {};
  if (typeof input === "string") return input.slice(0, 200);
  if (typeof input !== "object" || input === null) return "";

  if (tool === "bash" && (input.command || input.description)) {
    if (input.description && input.command) {
      return `${input.description.slice(0, 80)}  →  ${String(input.command).slice(0, 120)}`;
    }
    return String(input.command || input.description).slice(0, 200);
  }

  if (tool === "skill") {
    const name = input.name ?? input.skill ?? input.skill_name ?? input.id ?? "";
    const args = input.arguments ?? input.args ?? input.input ?? "";
    const argStr =
      typeof args === "string"
        ? args
        : Object.keys(args || {}).length
          ? JSON.stringify(args)
          : "";
    if (name && argStr) return `${name}  ·  ${argStr.slice(0, 120)}`;
    if (name) return String(name).slice(0, 200);
  }

  if (tool === "read" && (input.file_path || input.path || input.filePath)) {
    const path = String(input.file_path ?? input.filePath ?? input.path);
    if (input.offset != null || input.limit != null) {
      return `${path}  (offset ${input.offset ?? 0}, limit ${input.limit ?? "—"})`;
    }
    return path;
  }

  if (tool === "write" && (input.file_path || input.path || input.filePath)) {
    const path = String(input.file_path ?? input.filePath ?? input.path);
    const content = input.content ?? input.text ?? "";
    const len = typeof content === "string" ? content.length : 0;
    return len > 0 ? `${path}  ·  ${len} chars` : path;
  }

  if (tool === "edit" && (input.file_path || input.path || input.filePath)) {
    return String(input.file_path ?? input.filePath ?? input.path);
  }

  if ((tool === "glob" || tool === "grep") && input.pattern) {
    const where = input.path ? `  in ${input.path}` : "";
    return `${input.pattern}${where}`.slice(0, 200);
  }

  if ((tool === "webfetch" || tool === "fetch") && input.url) {
    return String(input.url).slice(0, 200);
  }

  if ((tool === "task" || tool === "agent") && (input.description || input.prompt)) {
    const sub = input.subagent_type || input.agent || "";
    const desc = input.description || input.prompt || "";
    return sub ? `${sub}  ·  ${desc}`.slice(0, 200) : String(desc).slice(0, 200);
  }

  if (tool === "todowrite" && Array.isArray(input.todos)) {
    return `${input.todos.length} todo(s)`;
  }
  if (tool === "todoread") return "lista todos";

  const known: Array<unknown> = [
    input.command,
    input.path,
    input.file_path,
    input.filePath,
    input.url,
    input.pattern,
    input.description,
    input.prompt,
    input.skill,
    input.skill_name,
    input.name,
    input.query,
  ];
  for (const candidate of known) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.slice(0, 200);
    }
  }

  for (const [k, v] of Object.entries(input)) {
    if (k === "type" || k === "id") continue;
    if (typeof v === "string" && v.trim() && v.length < 500) {
      return `${k}: ${v.slice(0, 180)}`;
    }
  }

  const keys = Object.keys(input).filter((k) => k !== "type" && k !== "id");
  return keys.length ? `(${keys.join(", ")})` : "";
}
