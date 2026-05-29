import { apiFetch } from "./client";

export type ComponentStatus = "ok" | "warn" | "err" | "unknown";

export type ComponentId =
  | "llm"
  | "opencode"
  | "env"
  | "worker"
  | "redis"
  | "postgres"
  | "clickhouse";

export interface Metric {
  value: string;
  label: string;
  unit?: string | null;
  suffix?: string | null;
}

export interface DiagnosticComponent {
  id: ComponentId;
  name: string;
  description: string;
  status: ComponentStatus;
  metric?: Metric | null;
  meta: string[];
  message?: string | null;
  causes: string[];
  last_check: string;
  latency_ms?: number | null;
  has_guide: boolean;
}

export interface ConfigGuideStep {
  title: string;
  body: string;
  snippet?: string | null;
}

export interface ConfigGuide {
  component_id: ComponentId;
  title: string;
  intro: string;
  steps: ConfigGuideStep[];
  footer_note?: string | null;
}

export interface DiagnosticsSummary {
  healthy: number;
  warning: number;
  error: number;
  unknown: number;
  total: number;
}

export interface DiagnosticsStatus {
  summary: DiagnosticsSummary;
  last_check: string;
  components: DiagnosticComponent[];
}

export const diagnostics = {
  status: () => apiFetch<DiagnosticsStatus>(`/diagnostics/status`),
  test: (id: ComponentId) =>
    apiFetch<DiagnosticComponent>(`/diagnostics/test/${id}`, { method: "POST" }),
  guide: (id: ComponentId) =>
    apiFetch<ConfigGuide>(`/diagnostics/guide/${id}`),
};

/** Severity rank pra escolher o componente "hero". Maior = mais grave. */
export function severityRank(status: ComponentStatus): number {
  switch (status) {
    case "err":
      return 3;
    case "warn":
      return 2;
    case "unknown":
      return 1;
    case "ok":
    default:
      return 0;
  }
}

/** Formata ISO timestamp como "há Ns" / "há Nmin" / "há Nh". */
export function formatRelativeAge(iso: string): string {
  const target = new Date(iso).getTime();
  const now = Date.now();
  const seconds = Math.max(0, Math.floor((now - target) / 1000));
  if (seconds < 60) return `há ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `há ${hours}h`;
}
