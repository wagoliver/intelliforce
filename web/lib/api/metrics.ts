import { apiFetch } from "./client";
import type { UUID } from "./types";

export interface TimelineBucket {
  completed: number;
  failed: number;
}

export interface DepartmentMetricsOut {
  department_id: UUID;
  registered_today: number;
  executed_last_12h: number;
  failed_last_12h: number;
  avg_handle_seconds: number | null;
  error_pct: number;
  timeline: TimelineBucket[];
  monthly_cost_usd: string;
}

export interface RecentExecution {
  task_id: UUID;
  status: string;
  finished_at: string | null;
}

export interface TaskHistoryItem {
  task_id: UUID;
  activity_id: UUID | null;
  activity_name: string | null;
  status: string;
  triggered_by: string;
  started_at: string | null;
  finished_at: string | null;
  duration_seconds: number | null;
  cost_usd: string;
  tokens_input: number;
  tokens_output: number;
  error_message: string | null;
  created_at: string;
}

export const metrics = {
  department: (id: UUID) =>
    apiFetch<DepartmentMetricsOut>(`/metrics/department/${id}`),
  history: (id: UUID, limit = 20) =>
    apiFetch<TaskHistoryItem[]>(`/metrics/department/${id}/history?limit=${limit}`),
  activityRecent: (id: UUID, limit = 10) =>
    apiFetch<RecentExecution[]>(`/metrics/activity/${id}/recent?limit=${limit}`),
};

/** Formata segundos como "0.4s" / "12s" / "2.1m" / "1.3h" */
export function formatHandle(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "—";
  if (seconds < 1) return `${(seconds * 1000).toFixed(0)}ms`;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}
