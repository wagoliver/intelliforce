// Client da API de tarefas. Contrato: worker/intelliforce/api/routes/tasks.py
import { apiFetch } from "./client";
import type { UUID } from "./types";

export type TaskStatus =
  | "pending"
  | "running"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "cancelled"
  | string;

export interface TaskOut {
  id: UUID;
  agent_id: UUID;
  status: TaskStatus;
  input: Record<string, unknown>;
  prompt: string;
  result_summary?: Record<string, unknown> | null;
  error_message?: string | null;
  opencode_session_id?: string | null;
  triggered_by: string;
  triggered_by_user_id?: UUID | null;
  correlation_id: string;
  started_at?: string | null;
  finished_at?: string | null;
  cost_usd: string | number; // Decimal serializado como string
  tokens_input: number;
  tokens_output: number;
  created_at: string;
  updated_at: string;
}

// Estados terminais não podem ser cancelados (espelha cancel_task no backend).
export const TERMINAL_STATUSES: TaskStatus[] = ["completed", "failed", "cancelled"];
export function isCancelable(status: TaskStatus): boolean {
  return !TERMINAL_STATUSES.includes(status);
}

export const tasks = {
  list: (params?: { status_filter?: string; agent_id?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.status_filter) q.set("status_filter", params.status_filter);
    if (params?.agent_id) q.set("agent_id", params.agent_id);
    if (params?.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return apiFetch<TaskOut[]>(`/tasks${qs ? `?${qs}` : ""}`);
  },
  get: (id: UUID) => apiFetch<TaskOut>(`/tasks/${id}`),
  cancel: (id: UUID, reason = "") =>
    apiFetch<TaskOut>(`/tasks/${id}/cancel`, { method: "POST", json: { reason } }),
};
