// Client da API de aprovações. Contrato: worker/intelliforce/api/routes/approvals.py
import { apiFetch } from "./client";
import type { UUID } from "./types";

export type ApprovalDecision = "PENDING" | "APPROVED" | "REJECTED";

export interface ApprovalOut {
  id: UUID;
  task_id: UUID;
  requested_reason: string;
  decision: ApprovalDecision | string;
  decision_reason?: string | null;
  responded_by_user_id?: UUID | null;
  responded_at?: string | null;
  created_at: string;
  updated_at: string;
}

export const approvals = {
  inbox: () => apiFetch<ApprovalOut[]>("/approvals/inbox"),
  approve: (id: UUID, reason = "") =>
    apiFetch<ApprovalOut>(`/approvals/${id}/approve`, { method: "POST", json: { reason } }),
  reject: (id: UUID, reason = "") =>
    apiFetch<ApprovalOut>(`/approvals/${id}/reject`, { method: "POST", json: { reason } }),
};
