export type ToolCallStatus = "running" | "done" | "error";

export type ToolCall = {
  id: string;
  tool: string;          // "Bash" | "Write" | "Read" | etc — vem do CLI
  description: string;   // 1-line summary (path, comando)
  status: ToolCallStatus;
  startedAt: number;            // ms epoch — pra cronômetro individual
  finishedAt: number | null;    // congela o tempo dela quando termina
};

/**
 * Linha "pensamento" — qualquer evento do CLI que não vira text nem tool.
 * Ex: reasoning chunk, step_start, status updates.
 */
export type ThinkingLine = {
  id: string;
  kind: string;          // tipo do evento (ex: "reasoning", "step", "status")
  label: string;         // texto curto pra exibição (já truncado)
  fullText?: string;     // texto completo (sem trunc) pra exibir no reveal
};

export type ChatMessage =
  | {
      id: string;
      role: "user";
      text: string;
    }
  | {
      id: string;
      role: "agent";
      text: string;
      toolCalls: ToolCall[];
      thinkingLines: ThinkingLine[];
      isStreaming: boolean;
      startedAt: number;        // ms epoch — pra cronômetro ao vivo enquanto streaming
      finishedAt: number | null; // ms epoch quando turn termina (congela o relógio)
      error?: string;
    };

export type ChatState = {
  messages: ChatMessage[];
  isStreaming: boolean;
  sessionId: string | null;
  error: string | null;
};

export type ChatAction =
  | { type: "USER_MESSAGE_SENT"; id: string; text: string }
  | { type: "AGENT_TURN_STARTED"; id: string }
  | { type: "TEXT_DELTA"; text: string }
  | { type: "TOOL_CALL_STARTED"; id: string; tool: string; description: string }
  | { type: "TOOL_CALL_FINISHED"; id: string; status: "done" | "error" }
  | { type: "THINKING_LINE"; id: string; kind: string; label: string; fullText?: string }
  | { type: "SESSION_ID"; sessionId: string }
  | { type: "AGENT_TURN_FINISHED" }
  | { type: "ERROR"; error: string }
  // Carrega transcrição salva no DB ao abrir conversa antiga da sidebar.
  | { type: "HYDRATE_FROM_HISTORY"; messages: ChatMessage[]; sessionId: string }
  // "+ Nova conversa" — limpa estado pra começar do zero.
  | { type: "RESET_CHAT" };
