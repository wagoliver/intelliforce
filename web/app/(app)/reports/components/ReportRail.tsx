"use client";

import { ChevronRight, FileText, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { formatRelativeAge } from "@/lib/api/diagnostics";
import type { DepartmentOut } from "@/lib/api/departments";
import type { ReportOut } from "@/lib/api/reports";
import { groupBySeries } from "@/lib/reports/grouping";

function instanceDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  } catch {
    return "";
  }
}

export function ReportRail({
  reports,
  departments,
  selectedId,
  onSelect,
}: {
  reports: ReportOut[];
  departments: DepartmentOut[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState("");
  const [tag, setTag] = useState("");
  const [source, setSource] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const deptName = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of departments) map.set(d.id, d.display_name || d.name);
    return map;
  }, [departments]);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    for (const r of reports) for (const t of r.tags ?? []) s.add(t);
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [reports]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reports.filter((r) => {
      if (dept && r.department_id !== dept) return false;
      if (source && r.source !== source) return false;
      if (tag && !(r.tags ?? []).includes(tag)) return false;
      if (q) {
        const hay = `${r.title} ${r.summary ?? ""} ${(r.tags ?? []).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [reports, query, dept, source, tag]);

  const groups = useMemo(() => groupBySeries(filtered), [filtered]);

  function toggle(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  return (
    <aside className="report-rail">
      <div className="report-rail-filters">
        <div className="report-search">
          <Search className="size-4 text-fg-subtle" />
          <input
            className="report-search-input"
            placeholder="Buscar relatórios…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="report-filter-row">
          <select className="report-select" value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">Todos os deptos</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.display_name || d.name}
              </option>
            ))}
          </select>
          <select className="report-select" value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="">Todas as tags</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select className="report-select" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">Origem</option>
            <option value="agent">Agente</option>
            <option value="user">Usuário</option>
          </select>
        </div>
      </div>

      <div className="report-rail-list">
        {groups.length === 0 && (
          <p className="report-rail-empty">Nenhum relatório encontrado.</p>
        )}
        {groups.map((g) => {
          const isCollapsed = collapsed.has(g.key);
          const dn = g.reports[0]?.department_id
            ? deptName.get(g.reports[0].department_id) ?? null
            : null;
          const single = g.reports.length === 1;
          const activeInGroup = g.reports.some((r) => r.id === selectedId);
          return (
            <div key={g.key} className={`report-group ${activeInGroup ? "has-active" : ""}`}>
              <button
                type="button"
                className="report-group-head"
                onClick={() =>
                  single ? onSelect(g.reports[0].id) : toggle(g.key)
                }
                aria-expanded={single ? undefined : !isCollapsed}
              >
                {single ? (
                  <FileText className="size-4 shrink-0 text-accent" />
                ) : (
                  <ChevronRight
                    className={`size-4 shrink-0 text-fg-subtle report-chevron ${isCollapsed ? "" : "is-open"}`}
                  />
                )}
                <span className="report-group-label">{g.label}</span>
                {!single && <span className="report-group-count">{g.reports.length}</span>}
              </button>
              <div className="report-group-sub">
                {dn && <span>{dn}</span>}
                <span>{formatRelativeAge(g.latest)}</span>
              </div>
              {!single && !isCollapsed && (
                <ul className="report-instances">
                  {g.reports.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        className={`report-instance ${r.id === selectedId ? "is-active" : ""}`}
                        onClick={() => onSelect(r.id)}
                      >
                        <span className="report-instance-date">{instanceDate(r.created_at)}</span>
                        <span className="report-instance-age">{formatRelativeAge(r.created_at)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
