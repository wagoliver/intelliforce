export type ToolCallStatus = "running" | "done" | "error";

export type ToolCall = {
  id: string;
  tool: string;          // "Bash" | "Write" | "Read" | etc — vem do CLI
  description: string;   // 1-line summary (path, comando)
  status: ToolCallStatus;
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
      isStreaming: boolean;
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
  | { type: "SESSION_ID"; sessionId: string }
  | { type: "AGENT_TURN_FINISHED" }
  | { type: "ERROR"; error: string };
