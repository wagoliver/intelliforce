// COPIADO DE web/app/(app)/skills/state/chatReducer.ts — manter em sincronia
import type { ChatAction, ChatMessage, ChatState } from "./types";

export const initialChatState: ChatState = {
  messages: [],
  isStreaming: false,
  sessionId: null,
  error: null,
};

function lastAgentMessage(messages: ChatMessage[]): ChatMessage | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "agent") return messages[i];
  }
  return null;
}

function updateLastAgentMessage(
  messages: ChatMessage[],
  updater: (msg: Extract<ChatMessage, { role: "agent" }>) => ChatMessage,
): ChatMessage[] {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "agent") {
      const next = [...messages];
      next[i] = updater(m);
      return next;
    }
  }
  return messages;
}

/**
 * Defesa em profundidade: força TODAS as agent messages com isStreaming=true
 * pra finalizado. Resolve estado órfão quando abort/error/network anomalia
 * deixa bolhas antigas com spinner girando eternamente.
 */
function closeAllStreaming(
  messages: ChatMessage[],
  markToolsAs: "done" | "error" = "done",
): ChatMessage[] {
  let changed = false;
  const now = Date.now();
  const next = messages.map((m) => {
    if (m.role !== "agent") return m;

    let updated = m;
    let touched = false;

    if (m.isStreaming) {
      updated = { ...updated, isStreaming: false, finishedAt: m.finishedAt ?? now };
      touched = true;
    }

    const hasRunningTool = m.toolCalls.some((tc) => tc.status === "running");
    if (hasRunningTool) {
      updated = {
        ...updated,
        toolCalls: m.toolCalls.map((tc) =>
          tc.status === "running"
            ? { ...tc, status: markToolsAs, finishedAt: tc.finishedAt ?? now }
            : tc,
        ),
      };
      touched = true;
    }

    if (touched) {
      changed = true;
      return updated;
    }
    return m;
  });
  return changed ? next : messages;
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "USER_MESSAGE_SENT": {
      return {
        ...state,
        error: null,
        messages: [...state.messages, { id: action.id, role: "user", text: action.text }],
      };
    }
    case "AGENT_TURN_STARTED": {
      const sanitized = closeAllStreaming(state.messages);
      return {
        ...state,
        isStreaming: true,
        messages: [
          ...sanitized,
          {
            id: action.id,
            role: "agent",
            text: "",
            toolCalls: [],
            thinkingLines: [],
            isStreaming: true,
            startedAt: Date.now(),
            finishedAt: null,
          },
        ],
      };
    }
    case "TEXT_DELTA": {
      return {
        ...state,
        messages: updateLastAgentMessage(state.messages, (m) => ({
          ...m,
          text: m.text + action.text,
        })),
      };
    }
    case "TOOL_CALL_STARTED": {
      return {
        ...state,
        messages: updateLastAgentMessage(state.messages, (m) => ({
          ...m,
          toolCalls: [
            ...m.toolCalls,
            {
              id: action.id,
              tool: action.tool,
              description: action.description,
              status: "running",
              startedAt: Date.now(),
              finishedAt: null,
            },
          ],
        })),
      };
    }
    case "TOOL_CALL_FINISHED": {
      return {
        ...state,
        messages: updateLastAgentMessage(state.messages, (m) => ({
          ...m,
          toolCalls: m.toolCalls.map((tc) =>
            tc.id === action.id
              ? { ...tc, status: action.status, finishedAt: Date.now() }
              : tc,
          ),
        })),
      };
    }
    case "THINKING_LINE": {
      return {
        ...state,
        messages: updateLastAgentMessage(state.messages, (m) => ({
          ...m,
          thinkingLines: [
            ...m.thinkingLines,
            {
              id: action.id,
              kind: action.kind,
              label: action.label,
              fullText: action.fullText,
            },
          ],
        })),
      };
    }
    case "SESSION_ID": {
      if (state.sessionId === action.sessionId) return state;
      return { ...state, sessionId: action.sessionId };
    }
    case "AGENT_TURN_FINISHED": {
      return {
        ...state,
        isStreaming: false,
        messages: closeAllStreaming(state.messages),
      };
    }
    case "ERROR": {
      const last = lastAgentMessage(state.messages);
      let messages = state.messages;
      if (last) {
        messages = updateLastAgentMessage(messages, (m) => ({
          ...m,
          error: action.error,
        }));
      }
      messages = closeAllStreaming(messages, "error");
      return {
        ...state,
        isStreaming: false,
        error: action.error,
        messages,
      };
    }
    case "HYDRATE_FROM_HISTORY": {
      return {
        messages: action.messages,
        sessionId: action.sessionId,
        isStreaming: false,
        error: null,
      };
    }
    case "RESET_CHAT": {
      return initialChatState;
    }
    default:
      return state;
  }
}
