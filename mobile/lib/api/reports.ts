// Client do Report Center. Contrato: worker/intelliforce/api/routes/reports.py
import { apiFetch } from "./client";
import type { UUID } from "./types";

export interface ReportOut {
  id: UUID;
  title: string;
  summary: string | null;
  tags: string[];
  source: string;
  department_id: UUID | null;
  agent_id: UUID | null;
  size_bytes: number;
  created_at: string;
}

export interface ReportDetailOut extends ReportOut {
  content: string;
}

export const reports = {
  list: () => apiFetch<ReportOut[]>("/reports"),
  get: (id: UUID) => apiFetch<ReportDetailOut>(`/reports/${id}`),
};

/** URL do proxy binário (preserva bytes do PDF). */
export function downloadUrl(id: UUID, fmt: "md" | "pdf"): string {
  return `/api/proxy-download/reports/${id}/download?format=${fmt}`;
}
