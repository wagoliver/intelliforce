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
      return {
        ...state,
        isStreaming: true,
        messages: [
          ...state.messages,
          { id: action.id, role: "agent", text: "", toolCalls: [], isStreaming: true },
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
            { id: action.id, tool: action.tool, description: action.description, status: "running" },
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
            tc.id === action.id ? { ...tc, status: action.status } : tc,
          ),
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
        messages: updateLastAgentMessage(state.messages, (m) => ({
          ...m,
          isStreaming: false,
        })),
      };
    }
    case "ERROR": {
      // Marca a última mensagem do agente (se existir) como erro e finaliza streaming
      const last = lastAgentMessage(state.messages);
      const messages = last
        ? updateLastAgentMessage(state.messages, (m) => ({
            ...m,
            isStreaming: false,
            error: action.error,
          }))
        : state.messages;
      return {
        ...state,
        isStreaming: false,
        error: action.error,
        messages,
      };
    }
    default:
      return state;
  }
}
