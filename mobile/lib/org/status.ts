// Status da força de trabalho (instâncias de agentes). Cores literais — independem
// do tema, como o radar — pra ficarem consistentes no claro e no escuro.
import type { DepartmentOut } from "@/lib/api/departments";

export type WorkStatus = "active" | "idle" | "offline" | "error";

export const STATUS_ORDER: WorkStatus[] = ["active", "idle", "offline", "error"];

export const STATUS_COLORS: Record<WorkStatus, string> = {
  active: "#10b981", // emerald-500
  idle: "#6ee7b7", // emerald-300
  offline: "#a1a1aa", // zinc-400
  error: "#ef4444", // red-500
};

export const STATUS_LABELS: Record<WorkStatus, string> = {
  active: "Ativo",
  idle: "Ocioso",
  offline: "Offline",
  error: "Erro",
};

export type StatusCounts = Record<WorkStatus, number>;

export function emptyCounts(): StatusCounts {
  return { active: 0, idle: 0, offline: 0, error: 0 };
}

export function totalCount(c: StatusCounts): number {
  return c.active + c.idle + c.offline + c.error;
}

/** Soma os contadores de todas as atividades de um departamento. */
export function aggregateCounts(dept: DepartmentOut): StatusCounts {
  const c = emptyCounts();
  for (const squad of dept.squads) {
    for (const a of squad.activities) {
      c.active += a.active_count;
      c.idle += a.idle_count;
      c.offline += a.offline_count;
      c.error += a.error_count;
    }
  }
  return c;
}

// ---- formatadores compartilhados ----
export function healthColor(h: string): string {
  if (h === "healthy") return "#10b981";
  if (h === "attention") return "#eab308";
  return "#a1a1aa";
}

export function money(v: string | number): string {
  const n = Number(v) || 0;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

/** Tempo futuro: "agora" / "em Nmin" / "em Nh" / "em Nd". */
export function formatFuture(iso: string | null): string {
  if (!iso) return "sem agenda";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "agora";
  const min = Math.round(ms / 60000);
  if (min < 60) return `em ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `em ${h}h`;
  return `em ${Math.floor(h / 24)}d`;
}
