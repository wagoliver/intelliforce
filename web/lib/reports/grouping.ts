// Agrupamento de relatórios por "série".
//
// O backend não tem campo de série: relatórios do mesmo tipo só diferem pela
// data no título (ex.: "Relatório Diário — Suporte 06/06" vs "… 05/06"). Aqui
// derivamos a série normalizando o título (removendo tokens de data) e juntando
// com o departamento. Heurístico e não-destrutivo: títulos fora do padrão caem
// em grupos unitários.
import type { ReportOut } from "@/lib/api/reports";

export interface ReportGroup {
  key: string;
  /** Rótulo legível da série (título normalizado, sem a data). */
  label: string;
  /** Instâncias da série, mais recente primeiro. */
  reports: ReportOut[];
  /** created_at da instância mais recente (ISO). */
  latest: string;
}

const MESES =
  "janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro";

// Tokens de data/período removidos do título para achar a "série".
const DATE_PATTERNS: RegExp[] = [
  /\b\d{4}-\d{2}-\d{2}\b/g, // 2026-06-06
  /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, // 06/06 ou 06/06/2026
  /\b\d{1,2}\.\d{1,2}(?:\.\d{2,4})?\b/g, // 06.06.2026
  /\bsemana\s*\d{1,2}\b/gi, // semana 23
  /\bsem\.?\s*\d{1,2}\b/gi, // sem 23
  /\b\d{1,2}h(?:\d{2})?\b/gi, // 14h / 14h30
  /\b\d{1,2}:\d{2}\b/g, // 14:30
  new RegExp(`\\b\\d{1,2}\\s*(?:de\\s*)?(?:${MESES})(?:\\s*(?:de\\s*)?\\d{2,4})?\\b`, "gi"),
  new RegExp(`\\b(?:${MESES})(?:\\s*(?:de\\s*)?\\d{2,4})?\\b`, "gi"),
];

/** Normaliza o título a um rótulo de série estável. */
export function seriesLabel(title: string): string {
  let s = title ?? "";
  for (const re of DATE_PATTERNS) s = s.replace(re, " ");
  // Limpa pontuação/conectores soltos deixados pela remoção da data.
  s = s
    .replace(/[—–-]+\s*$/g, "") // traço final órfão
    .replace(/[·•|]+/g, " ")
    .replace(/\(\s*\)/g, "") // parênteses vazios
    .replace(/\s*[—–-]\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s—–\-·•]+|[\s—–\-·•]+$/g, "")
    .trim();
  return s || (title ?? "").trim() || "Relatório";
}

/** Agrupa relatórios por série (título normalizado + departamento). */
export function groupBySeries(reports: ReportOut[]): ReportGroup[] {
  const byKey = new Map<string, ReportGroup>();

  for (const r of reports) {
    const label = seriesLabel(r.title);
    const key = `${label.toLowerCase()}·${r.department_id ?? ""}`;
    const group = byKey.get(key);
    if (group) {
      group.reports.push(r);
    } else {
      byKey.set(key, { key, label, reports: [r], latest: r.created_at });
    }
  }

  const groups = [...byKey.values()];
  for (const g of groups) {
    g.reports.sort((a, b) => b.created_at.localeCompare(a.created_at));
    g.latest = g.reports[0]?.created_at ?? g.latest;
  }
  groups.sort((a, b) => b.latest.localeCompare(a.latest));
  return groups;
}
