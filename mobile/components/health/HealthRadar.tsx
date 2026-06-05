// Radar de saúde: núcleo sólido + ondas de rádio emanando (cores literais,
// independentes do tema). Porta a lógica do indicador do web/app-shell.
import type { DiagnosticsSummary } from "@/lib/api/diagnostics";

export type HealthLevel = "ok" | "warn" | "err";

/** Reduz o summary aos 3 estados visuais. `unknown` cai em atenção. */
export function deriveHealthLevel(s: DiagnosticsSummary): HealthLevel {
  if (s.error > 0) return "err";
  if (s.warning > 0 || s.unknown > 0) return "warn";
  return "ok";
}

export function HealthRadar({ level, size = 16 }: { level: HealthLevel; size?: number }) {
  return (
    <span
      className={`health-dot is-${level}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span className="health-core" />
    </span>
  );
}
