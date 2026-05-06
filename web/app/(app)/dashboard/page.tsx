"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { departments as deptsApi, type DepartmentOut } from "@/lib/api/departments";
import { metrics as metricsApi, formatHandle, type DepartmentMetricsOut, type TaskHistoryItem, type TimelineBucket, type RecentExecution } from "@/lib/api/metrics";

// Converte DepartmentOut do backend pro shape esperado pelo render do mockup.
// `metrics` é populado depois via fetch a /metrics/department/{id}.
function toOrgShape(dept: DepartmentOut, m?: DepartmentMetricsOut | null): any {
  const teams = dept.squads.map((s) => ({
    name: s.display_name,
    roles: s.activities.map((a) => ({
      id: a.id,
      name: a.display_name,
      count: a.agent_count,
      skill: a.skill_code || "···",
      next_run: a.next_run,
      schedule: a.schedule,
    })),
  }));

  let active = 0, idle = 0, offline = 0, error = 0;
  for (const squad of dept.squads) {
    for (const act of squad.activities) {
      active += act.active_count;
      idle += act.idle_count;
      offline += act.offline_count;
      error += act.error_count;
    }
  }

  return {
    id: dept.id,
    slug: dept.name,
    name: dept.display_name,
    owner: dept.owner
      ? { name: dept.owner.name, role: dept.owner.role }
      : { name: "—", role: "" },
    objective: dept.objective || "",
    cost: {
      monthly: m ? Number(m.monthly_cost_usd) : Number(dept.monthly_cost_budget_usd) || 0,
      currency: "USD",
    },
    health: dept.health,
    teams,
    agents: { active, idle, offline, error },
    next_run: dept.next_run,
    metrics: {
      registered: m?.registered_today ?? 0,
      avgHandle: formatHandle(m?.avg_handle_seconds ?? null),
      errorPct: m?.error_pct ?? 0,
      executed: m?.executed_last_12h ?? 0,
      timeline: m?.timeline ?? Array(12).fill({ completed: 0, failed: 0 }),
      failed: m?.failed_last_12h ?? 0,
    },
  };
}

/** Formata "em 3h 22min", "em 45min", "em 12s", "agora" */
function formatRelative(iso: string | null, t: any): string {
  if (!iso) return t("next_run_none");
  const target = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, Math.floor((target - now) / 1000));
  if (diff < 60) return diff < 1 ? t("running_now") : t("in_seconds", { n: diff });
  const minutes = Math.floor(diff / 60);
  if (minutes < 60) return t("in_minutes", { n: minutes });
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return t("in_hours", { h: hours, m: mins });
  const days = Math.floor(hours / 24);
  const remH = hours % 24;
  return t("in_days", { d: days, h: remH });
}


// Cores ajustadas (compartilhadas entre tile, mini-bar, legenda).
// Verde forte = executando · verde pastel = pronto/idle · magenta = awaiting human · cinza = offline/pending · vermelho = error.
const AGENT_COLORS: Record<string, string> = {
  active: "oklch(0.48 0.20 155)",
  running: "oklch(0.48 0.20 155)",
  idle: "oklch(0.86 0.06 165)",
  offline: "oklch(0.78 0.005 250)",
  pending: "oklch(0.78 0.005 250)",
  awaiting_approval: "oklch(0.58 0.18 290)",
  error: "var(--danger)",
};

function AgentTile({ status = "active", size = 14, skill }: any) {
  return (
    <div className="agent-tile" style={{ width: size, height: size, color: AGENT_COLORS[status] }} title={`${skill || "agent"} · ${status}`}>
      <svg viewBox="0 0 64 64">
        <path d="M10 10 H54 V54 H10 Z M22 22 V42 H42 V22 Z" fill="currentColor" fillRule="evenodd" />
      </svg>
    </div>
  );
}

function buildAgentArray({ active, idle, offline, error }: any) {
  const arr = [];
  for (let i = 0; i < active; i++) arr.push("active");
  for (let i = 0; i < idle; i++) arr.push("idle");
  for (let i = 0; i < offline; i++) arr.push("offline");
  for (let i = 0; i < error; i++) arr.push("error");
  return arr;
}

const Ico: any = {
  home: <path d="M3 9.5l5-5 5 5V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round"/>,
  agents: <g stroke="currentColor" strokeWidth="1.4" fill="none"><circle cx="8" cy="6" r="2.5"/><path d="M3 13.5c0-2.2 2.2-4 5-4s5 1.8 5 4"/></g>,
  proc: <g stroke="currentColor" strokeWidth="1.4" fill="none"><rect x="2.5" y="3" width="4" height="4" rx="0.5"/><rect x="9.5" y="3" width="4" height="4" rx="0.5"/><rect x="6" y="9" width="4" height="4" rx="0.5"/><path d="M4.5 7v1M11.5 7v1M6 11h-1.5v-3M10 11h1.5v-3"/></g>,
  queue: <g stroke="currentColor" strokeWidth="1.4" fill="none"><rect x="2.5" y="3" width="11" height="2.5" rx="0.5"/><rect x="2.5" y="6.75" width="11" height="2.5" rx="0.5"/><rect x="2.5" y="10.5" width="11" height="2.5" rx="0.5"/></g>,
  org: <g stroke="currentColor" strokeWidth="1.4" fill="none"><rect x="6" y="2.5" width="4" height="3" rx="0.5"/><rect x="2" y="10.5" width="4" height="3" rx="0.5"/><rect x="10" y="10.5" width="4" height="3" rx="0.5"/><path d="M8 5.5v2.5M4 10.5V8h8v2.5"/></g>,
  intg: <g stroke="currentColor" strokeWidth="1.4" fill="none"><path d="M5 3v3h-2v4h2v3M11 3v3h2v4h-2v3"/></g>,
  people: <g stroke="currentColor" strokeWidth="1.4" fill="none"><circle cx="6" cy="6" r="2"/><circle cx="11" cy="6" r="1.5"/><path d="M2.5 13c0-1.8 1.5-3.2 3.5-3.2s3.5 1.4 3.5 3.2M9.5 13c0-1.4 1-2.5 2-2.5s2 1.1 2 2.5"/></g>,
  insights: <g stroke="currentColor" strokeWidth="1.4" fill="none"><path d="M3 13V8M7 13V4M11 13V10"/></g>,
  set: <g stroke="currentColor" strokeWidth="1.4" fill="none"><circle cx="8" cy="8" r="2"/><path d="M8 1.5v1.5M8 13v1.5M14.5 8H13M3 8H1.5M12.5 3.5l-1 1M4.5 11.5l-1 1M12.5 12.5l-1-1M4.5 4.5l-1-1"/></g>,
  search: <g stroke="currentColor" strokeWidth="1.4" fill="none"><circle cx="6.5" cy="6.5" r="3.5"/><path d="M9 9l3 3"/></g>,
  bell: <g stroke="currentColor" strokeWidth="1.4" fill="none"><path d="M4 11V7a4 4 0 0 1 8 0v4l1 1H3l1-1zM7 13h2"/></g>,
  arrow: <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.4" fill="none"/>,
  theme: <g stroke="currentColor" strokeWidth="1.4" fill="none"><path d="M11 8.5A4 4 0 0 1 7.5 4 a4 4 0 1 0 3.5 4.5z"/></g>,
  chev: <path d="M5 7l3 3 3-3" stroke="currentColor" strokeWidth="1.4" fill="none"/>,
  user: <g stroke="currentColor" strokeWidth="1.4" fill="none"><circle cx="8" cy="6" r="2.5"/><path d="M3 13.5c0-2.2 2.2-4 5-4s5 1.8 5 4"/></g>,
  goal: <g stroke="currentColor" strokeWidth="1.4" fill="none"><circle cx="8" cy="8" r="5.5"/><circle cx="8" cy="8" r="2.5"/></g>,
  cost: <g stroke="currentColor" strokeWidth="1.4" fill="none"><circle cx="8" cy="8" r="5.5"/><path d="M9 6h-1.5a1.5 1.5 0 0 0 0 3h1a1.5 1.5 0 1 1 0 3H7M8 5v1M8 12v1"/></g>,
  menuLeft: <path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
  menuRight: <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
  edit: <g stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M3 13l1-3 7-7 2 2-7 7-3 1z"/></g>,
  plus: <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none"/>,
  cron: <g stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round"><circle cx="8" cy="8" r="5.5"/><path d="M8 5v3l2 2"/></g>,
  pin: <path d="M8 1.5l1.5 4 4 .6-3 2.8.7 4L8 11l-3.2 1.9.7-4-3-2.8 4-.6L8 1.5z" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round"/>,
  pinFilled: <path d="M8 1.5l1.5 4 4 .6-3 2.8.7 4L8 11l-3.2 1.9.7-4-3-2.8 4-.6L8 1.5z" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>,
};

const SvgIcon = ({ name, ...rest }: any) => (
  <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" {...rest}>{Ico[name]}</svg>
);

// Barra horizontal proporcional dos agentes do dept (substitui o grid completo na linha colapsada).
function MiniAgentBar({ agents }: { agents: any }) {
  const segs = [
    { key: "active", v: agents.active, color: AGENT_COLORS.active },
    { key: "idle", v: agents.idle, color: AGENT_COLORS.idle },
    { key: "offline", v: agents.offline, color: AGENT_COLORS.offline },
    { key: "error", v: agents.error, color: AGENT_COLORS.error },
  ].filter((s) => s.v > 0);
  return (
    <div
      className="mini-bar"
      title={`${agents.active} active · ${agents.idle} idle · ${agents.offline} offline · ${agents.error} error`}
    >
      {segs.map((s) => (
        <div key={s.key} className="mini-bar-seg" style={{ flex: s.v, background: s.color }} />
      ))}
    </div>
  );
}

// Sparkline compacta da timeline 12h (usada no header colapsado).
function MiniSparkline({ data, health }: { data: TimelineBucket[]; health: string }) {
  const w = 140, h = 28;
  const totals = data.map((b) => (b.completed || 0) + (b.failed || 0));
  const max = Math.max(1, ...totals);
  const barW = (w - (data.length - 1) * 2) / data.length;
  const successColor = health === "attention" ? "var(--warning)" : "var(--accent-green)";
  const failColor = "var(--danger)";
  return (
    <svg className="sparkline" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: w, height: h }}>
      {data.map((b, i) => {
        const total = (b.completed || 0) + (b.failed || 0);
        if (total === 0) return null;
        const totalH = Math.max(2, (total / max) * (h - 2));
        const failH = ((b.failed || 0) / total) * totalH;
        const okH = totalH - failH;
        const x = i * (barW + 2);
        return (
          <g key={i}>
            {failH > 0 && <rect x={x} y={h - failH} width={barW} height={failH} fill={failColor} opacity={0.85} rx={1} />}
            {okH > 0 && <rect x={x} y={h - failH - okH} width={barW} height={okH} fill={successColor} opacity={0.4 + (total / max) * 0.6} rx={1} />}
          </g>
        );
      })}
    </svg>
  );
}

function FilterBar({
  sortBy, onSort, healthFilter, onHealth, count, total,
}: {
  sortBy: string; onSort: (v: string) => void;
  healthFilter: string; onHealth: (v: string) => void;
  count: number; total: number;
}) {
  const t = useTranslations("dashboard");
  const sortOpts = [
    { id: "attention", label: t("filter_sort_attention") },
    { id: "activities", label: t("filter_sort_activities") },
    { id: "cost", label: t("filter_sort_cost") },
    { id: "name", label: t("filter_sort_name") },
  ];
  const healthOpts = [
    { id: "all", label: t("filter_health_all") },
    { id: "healthy", label: t("filter_health_healthy") },
    { id: "attention", label: t("filter_health_attention") },
  ];
  return (
    <div className="filter-bar">
      <div className="fb-group">
        <span className="fb-label">{t("filter_show")}</span>
        <div className="fb-pills">
          {healthOpts.map((o) => (
            <button key={o.id} className={`fb-pill ${healthFilter === o.id ? "active" : ""}`} onClick={() => onHealth(o.id)}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div className="fb-group">
        <span className="fb-label">{t("filter_sort_by")}</span>
        <div className="fb-pills">
          {sortOpts.map((o) => (
            <button key={o.id} className={`fb-pill ${sortBy === o.id ? "active" : ""}`} onClick={() => onSort(o.id)}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div className="fb-count">{t("filter_count", { count, total })}</div>
    </div>
  );
}

function OrgHeader({ orgList }: { orgList: any[] }) {
  const t = useTranslations("dashboard");
  const totalAgents = orgList.reduce((s, d: any) => s + Object.values(d.agents).reduce((a: any, b: any) => a + b, 0), 0);
  const totalActive = orgList.reduce((s, d) => s + d.agents.active, 0);
  const totalCost = orgList.reduce((s, d) => s + d.cost.monthly, 0);

  // SLA real: 100% - média ponderada de error_pct (peso = execuções nas últimas 12h).
  // Se nenhum dept tem dados, mostra "—" em vez de inventar número.
  const totalExecuted = orgList.reduce((s, d) => s + (d.metrics?.executed ?? 0), 0);
  const weightedError = orgList.reduce(
    (s, d) => s + (d.metrics?.errorPct ?? 0) * (d.metrics?.executed ?? 0),
    0,
  );
  const slaDisplay =
    totalExecuted > 0
      ? `${(100 - weightedError / totalExecuted).toFixed(1)}%`
      : "—";

  return (
    <header className="org-header">
      <div className="oh-head">
        <div className="oh-eyebrow">{t("eyebrow")}</div>
        <h1 className="oh-title">
          <span className="num">{orgList.length}</span> {t("title_a")}&nbsp;
          <span className="num">{totalAgents.toLocaleString()}</span> {t("title_b")}
        </h1>
      </div>
      <div className="oh-stats">
        <div className="oh-stat">
          <div className="oh-stat-l">{t("active_now")}</div>
          <div className="oh-stat-v">{totalActive.toLocaleString()}<span className="oh-stat-d"> / {totalAgents.toLocaleString()}</span></div>
        </div>
        <div className="oh-stat">
          <div className="oh-stat-l">{t("monthly_cost")}</div>
          <div className="oh-stat-v">${(totalCost/1000).toFixed(1)}k</div>
        </div>
        <div className="oh-stat">
          <div className="oh-stat-l">{t("avg_sla")}</div>
          <div className="oh-stat-v" title={`SLA = 100% - média ponderada de erro (${totalExecuted.toLocaleString()} execuções últimas 12h)`}>
            {slaDisplay}
          </div>
        </div>
        <a className="oh-cta" href="/skills?cmd=new-dept" title="Conversa com o Operator pra criar um departamento novo">
          <SvgIcon className="ico" name="plus" />
          {t("new_department")}
        </a>
      </div>
    </header>
  );
}

function DepartmentRow({
  dept, expanded, pinned, onToggle, onPin,
}: {
  dept: any; expanded: boolean; pinned: boolean;
  onToggle: () => void; onPin: () => void;
}) {
  const t = useTranslations("dashboard");
  const totalAgents = Object.values(dept.agents).reduce((a: any, b: any) => a + b, 0) as number;
  const executedDisplay =
    dept.metrics.executed >= 1000
      ? `${(dept.metrics.executed / 1000).toFixed(1)}k`
      : dept.metrics.executed.toLocaleString();
  const healthLabel = dept.health === "healthy" ? t("on_track") : t("needs_attention");

  return (
    <section
      className={`dept dept--${dept.health} ${expanded ? "is-open" : ""} ${pinned ? "is-pinned" : ""}`}
      onMouseMove={(e) => {
        const target = e.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        target.style.setProperty("--mx", `${e.clientX - rect.left}px`);
        target.style.setProperty("--my", `${e.clientY - rect.top}px`);
      }}
    >
      {/* Linha colapsada — sempre visível */}
      <button
        type="button"
        className="dept-row-head"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={expanded ? t("collapse") : t("expand")}
      >
        <div className="drh-mark">
          <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 10 H54 V54 H10 Z M22 22 V42 H42 V22 Z" fill="currentColor" fillRule="evenodd" />
          </svg>
        </div>
        <div className="drh-name">
          <div className="drh-name-row">
            <span className="dept-name-compact">{dept.name}</span>
            {dept.agents.error > 0 && (
              <span className="drh-error-pip">{t("error_short", { n: dept.agents.error })}</span>
            )}
          </div>
          <div className={`dept-health dept-health--${dept.health}`}>
            <span className="dot" /> {healthLabel}
          </div>
        </div>
        <div className="drh-owner">
          <SvgIcon className="ico" name="user" />
          <div>
            <div className="drh-owner-name">{dept.owner.name}</div>
            {dept.owner.role && <div className="drh-owner-role">{dept.owner.role}</div>}
          </div>
        </div>
        <div className="drh-bar">
          <MiniAgentBar agents={dept.agents} />
          <span className="drh-bar-count">
            <strong>{dept.agents.active}</strong>
            <span className="muted"> / {totalAgents} {t("bar_active_lower")}</span>
          </span>
        </div>
        <div className="drh-kpi">
          <div className="drh-kpi-text">
            <div className="drh-kpi-v">{executedDisplay}</div>
            <div className="drh-kpi-l">{t("kpi_activities_12h")}</div>
          </div>
          <MiniSparkline data={dept.metrics.timeline} health={dept.health} />
        </div>
        <div className="drh-actions">
          <span
            className={`drh-pin ${pinned ? "is-pinned" : ""}`}
            onClick={(e) => { e.stopPropagation(); onPin(); }}
            title={pinned ? t("unpin") : t("pin_to_top")}
          >
            <SvgIcon className="ico" name={pinned ? "pinFilled" : "pin"} />
          </span>
          <span className="drh-chev"><SvgIcon className="ico" name="chev" /></span>
        </div>
      </button>

      {expanded && <DepartmentDossier dept={dept} />}
    </section>
  );
}

// Dossiê expandido — código equivalente ao DepartmentRow original.
// Histórico/AlphaDots só fazem fetch enquanto este componente está montado (aberto).
function DepartmentDossier({ dept }: any) {
  const t = useTranslations("dashboard");
  const totalAgents = Object.values(dept.agents).reduce((a: any, b: any) => a + b, 0) as number;
  const tiles = useMemo(() => buildAgentArray(dept.agents), [dept.id]);
  const historyState = useState(null);
  const history = historyState[0];
  const setHistory = historyState[1];

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const h = await metricsApi.history(dept.id, 10).catch(() => []);
      if (!cancelled) setHistory(h);
    }
    load();
    const interval = setInterval(load, 15_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [dept.id]);

  return (
    <div className="dept-dossier">
      <div className="dept-left">
        <div className="dept-meta">
          <div className="dm-row">
            <SvgIcon className="dm-icon" name="user" />
            <div>
              <div className="dm-l">{t("owner")}</div>
              <div className="dm-v">
                <strong>{dept.owner.name}</strong>
                {dept.owner.role && <> · {dept.owner.role}</>}
              </div>
            </div>
          </div>
          <div className="dm-row">
            <SvgIcon className="dm-icon" name="goal" />
            <div>
              <div className="dm-l">{t("objective")}</div>
              <div className="dm-v">{dept.objective || t("no_objective")}</div>
            </div>
          </div>
          <div className="dm-row">
            <SvgIcon className="dm-icon" name="cost" />
            <div>
              <div className="dm-l">{t("monthly_cost")}</div>
              <div className="dm-v"><strong>${dept.cost.monthly.toLocaleString()}</strong> {t("monthly_cost_per_month")}</div>
            </div>
          </div>
          <div className="dm-row">
            <SvgIcon className="dm-icon" name="cron" />
            <div>
              <div className="dm-l">{t("next_run")}</div>
              <div className="dm-v">
                <strong>{formatRelative(dept.next_run, t)}</strong>
                {dept.next_run && (
                  <span style={{ color: "var(--text-subtle)", marginLeft: 6, fontSize: 12 }}>
                    · {new Date(dept.next_run).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <a
          className="dept-edit-btn"
          href={`/skills?cmd=edit-dept&id=${dept.id}`}
          title="Conversa com o Operator pra editar"
        >
          <SvgIcon className="ico" name="edit" />
          {t("edit")}
        </a>
      </div>

      <div className="dept-mid">
        <div className="dept-mid-label">{t("structure")}</div>
        <div className="teams">
          {dept.teams.map((team: any) => (
            <div key={team.name} className="team">
              <div className="team-name">{team.name}</div>
              <div className="roles">
                {team.roles.map((r: any) => (
                  <div key={r.id || r.name} className="role">
                    <span className="role-skill">{r.skill}</span>
                    <span className="role-name" style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap" }}>
                      <span>{r.name}</span>
                      <AlphaDots activityId={r.id} />
                      {r.next_run && (
                        <span style={{
                          marginLeft: 8, fontSize: 11,
                          color: "var(--text-subtle)",
                          fontFamily: "var(--font-mono)",
                        }}>
                          — {new Date(r.next_run).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{" "}
                          <em style={{ fontStyle: "normal", color: "var(--accent)" }}>({t("next_run")})</em>
                        </span>
                      )}
                    </span>
                    <span className="role-count">{r.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="dept-right">
        <div className="dept-right-head">
          <div className="dept-right-label">{t("workforce_label")} · {totalAgents as number} {t("agents_label")}</div>
          <div className="dept-right-legend">
            <span><AgentTile status="active" size={8} /> {dept.agents.active}</span>
            <span><AgentTile status="idle" size={8} /> {dept.agents.idle}</span>
            {dept.agents.error > 0 && <span><AgentTile status="error" size={8} /> {dept.agents.error}</span>}
            {dept.agents.offline > 0 && <span><AgentTile status="offline" size={8} /> {dept.agents.offline}</span>}
          </div>
        </div>
        <div className="agent-grid">
          {tiles.map((s, i) => <AgentTile key={i} status={s} size={14} />)}
        </div>
        <div className="dept-metrics">
          <div className="dme">
            <span className="dme-l">{t("registered_today")}</span>
            <span className="dme-v">{dept.metrics.registered.toLocaleString()}</span>
            <span className="dme-s">{t("agents_label")}</span>
          </div>
          <div className="dme">
            <span className="dme-l">{t("avg_handle")}</span>
            <span className="dme-v">{dept.metrics.avgHandle}</span>
            <span className="dme-s">{t("per_activity")}</span>
          </div>
          <div className="dme">
            <span className="dme-l">{t("error_rate")}</span>
            <span className={`dme-v ${dept.metrics.errorPct > 2 ? "warn" : ""}`}>{dept.metrics.errorPct}%</span>
            <span className="dme-s">{t("last_24h")}</span>
          </div>
        </div>

        <div className="dept-timeline">
          <div className="dt-head">
            <span className="dt-label">{t("activities_last_12h")}</span>
            <span className="dt-total">{dept.metrics.executed.toLocaleString()} {t("done_suffix")}</span>
          </div>
          <HistorySection history={history} />
          <Timeline data={dept.metrics.timeline} health={dept.health} />
        </div>
      </div>
    </div>
  );
}

function HistorySection({ history }: { history: any }) {
  const t = useTranslations("dashboard");
  const failedCount = useMemo(
    () => (history ?? []).filter((h: any) => h.status === "failed").length,
    [history],
  );
  const [open, setOpen] = useState(false);
  const [userToggled, setUserToggled] = useState(false);

  // Abre automático se aparecer falha — a menos que o usuário já tenha mexido manualmente.
  useEffect(() => {
    if (!userToggled && failedCount > 0) setOpen(true);
  }, [failedCount, userToggled]);

  if (history === null) return null;

  const toggle = () => {
    setUserToggled(true);
    setOpen((v) => !v);
  };

  return (
    <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        style={{
          all: "unset", cursor: "pointer", width: "100%",
          display: "flex", alignItems: "center", gap: 6,
          fontSize: 11, color: "var(--text-subtle)", letterSpacing: "0.06em",
          textTransform: "uppercase", fontWeight: 600,
          marginBottom: open ? 8 : 0,
        }}
      >
        <SvgIcon
          className="ico"
          name="chev"
          style={{
            width: 12, height: 12,
            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
            transition: "transform 120ms ease",
          }}
        />
        <span>{t("history_title")} ({history.length})</span>
        {failedCount > 0 && (
          <span style={{ color: "var(--danger)", textTransform: "none", letterSpacing: 0 }}>
            · {t("failed_count", { n: failedCount })}
          </span>
        )}
      </button>
      {!open ? null : history.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "4px 0" }}>
          {t("history_empty")}
        </div>
      ) : (
        <div style={{ maxHeight: 180, overflow: "auto", display: "grid", gap: 4 }}>
          {history.map((h: any) => (
            <div key={h.task_id} style={{
              display: "grid", gridTemplateColumns: "auto 1fr auto auto",
              gap: 10, alignItems: "center",
              fontSize: 12, padding: "4px 0",
            }}>
              <StatusDot status={h.status} />
              <div style={{ minWidth: 0 }}>
                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {h.activity_name ?? "—"}
                </div>
                {h.error_message && (
                  <div style={{ color: "var(--danger)", fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {h.error_message}
                  </div>
                )}
              </div>
              <span style={{
                color: h.status === "running" ? "var(--accent)" : "var(--text-subtle)",
                fontFamily: "var(--font-mono)",
              }}>
                {h.duration_seconds != null
                  ? `${h.duration_seconds.toFixed(1)}s`
                  : h.status === "running" ? t("status_running")
                  : h.status === "pending" ? t("status_pending")
                  : h.status === "awaiting_approval" ? t("status_awaiting_approval")
                  : "—"}
              </span>
              <span style={{ color: "var(--text-subtle)", fontFamily: "var(--font-mono)" }}>
                {new Date(h.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color: Record<string, string> = {
    completed: "oklch(0.48 0.20 155)",
    running: "var(--accent)",
    pending: "oklch(0.78 0.005 250)",
    awaiting_approval: "oklch(0.58 0.18 290)",
    failed: "var(--danger)",
    cancelled: "var(--text-subtle)",
  };
  return (
    <span style={{
      width: 8, height: 8, borderRadius: 999,
      background: color[status] ?? "var(--text-subtle)",
      flexShrink: 0,
    }} title={status} />
  );
}

function Timeline({ data, health }: any) {
  const w = 320, h = 36;
  const buckets: TimelineBucket[] = data;
  const totals = buckets.map((b) => (b.completed || 0) + (b.failed || 0));
  const max = Math.max(1, ...totals);
  const barW = (w - (buckets.length - 1) * 3) / buckets.length;
  const successColor = health === "attention" ? "var(--warning)" : "var(--accent)";
  const failColor = "var(--danger)";

  return (
    <svg className="timeline-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      {buckets.map((b, i) => {
        const total = (b.completed || 0) + (b.failed || 0);
        if (total === 0) return null;
        const totalH = (total / max) * (h - 2);
        const failH = ((b.failed || 0) / total) * totalH;
        const okH = totalH - failH;
        const x = i * (barW + 3);
        return (
          <g key={i}>
            {failH > 0 && (
              <rect x={x} y={h - failH} width={barW} height={failH}
                fill={failColor} opacity={0.85} rx={1} />
            )}
            {okH > 0 && (
              <rect x={x} y={h - failH - okH} width={barW} height={okH}
                fill={successColor} opacity={0.4 + (total / max) * 0.6} rx={1} />
            )}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * AlphaDots — bolinhas dos últimos N status, mais antigo mais transparente.
 * Verde = completed, vermelho = failed, cinza = outros.
 */
function AlphaDots({ activityId }: { activityId: string }) {
  const itemsState = useState([]);
  const items = itemsState[0];
  const setItems = itemsState[1];

  useEffect(() => {
    if (!activityId) return;
    let cancelled = false;
    async function load() {
      const r = await metricsApi.activityRecent(activityId, 8).catch(() => []);
      if (!cancelled) setItems(r);
    }
    load();
    const interval = setInterval(load, 15_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [activityId]);

  if (items.length === 0) return null;

  const colors: Record<string, string> = {
    completed: "oklch(0.48 0.20 155)",
    failed: "var(--danger)",
    running: "var(--accent)",
    pending: "oklch(0.78 0.005 250)",
    cancelled: "var(--text-subtle)",
    awaiting_approval: "oklch(0.58 0.18 290)",
  };

  return (
    <span style={{ display: "inline-flex", gap: 3, alignItems: "center", marginLeft: 8 }}>
      {items.slice().reverse().map((it, idx) => {
        const total = items.length;
        const alpha = 0.25 + (idx / Math.max(1, total - 1)) * 0.75;
        return (
          <span
            key={it.task_id}
            title={`${it.status}${it.finished_at ? " · " + new Date(it.finished_at).toLocaleString() : ""}`}
            style={{
              width: 7, height: 7, borderRadius: 999,
              background: colors[it.status] ?? "var(--text-subtle)",
              opacity: alpha,
            }}
          />
        );
      })}
    </span>
  );
}

export default function HomeV2Page() {
  const orgState = useState<any[] | null>(null);
  const orgData = orgState[0];
  const setOrgData = orgState[1];
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<string>("attention");
  const [healthFilter, setHealthFilter] = useState<string>("all");
  // Track quais ids já foram auto-expandidos pra não reabrir depois que o user fechou.
  const [autoSeen, setAutoSeen] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const list = await deptsApi.list();
        const withMetrics = await Promise.all(
          list.map(async (d) => {
            const m = await metricsApi.department(d.id).catch(() => null);
            return toOrgShape(d, m);
          }),
        );
        if (!cancelled) setOrgData(withMetrics);
      } catch {
        if (!cancelled) setOrgData([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // Auto-expand depts em atenção ou com erro — só uma vez por id (não reabre se o user fechou).
  useEffect(() => {
    if (!orgData) return;
    setAutoSeen((prevSeen) => {
      const newlySeen = new Set(prevSeen);
      const toOpen: string[] = [];
      for (const d of orgData) {
        if (prevSeen.has(d.id)) continue;
        if (d.health === "attention" || d.agents.error > 0) toOpen.push(d.id);
        newlySeen.add(d.id);
      }
      if (toOpen.length > 0) {
        setExpanded((prev) => {
          const next = new Set(prev);
          for (const id of toOpen) next.add(id);
          return next;
        });
      }
      return newlySeen;
    });
  }, [orgData]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const togglePin = (id: string) => {
    setPinned((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        // pinning também expande
        setExpanded((p) => { const ns = new Set(p); ns.add(id); return ns; });
      }
      return next;
    });
  };

  const orgList = orgData ?? [];

  const visibleList = useMemo(() => {
    let list = orgList;
    if (healthFilter !== "all") list = list.filter((d: any) => d.health === healthFilter);
    list = [...list].sort((a: any, b: any) => {
      const ap = pinned.has(a.id), bp = pinned.has(b.id);
      if (ap !== bp) return ap ? -1 : 1;
      switch (sortBy) {
        case "attention": {
          const order: Record<string, number> = { attention: 0, healthy: 1 };
          if (a.health !== b.health) return (order[a.health] ?? 9) - (order[b.health] ?? 9);
          return (b.metrics?.executed ?? 0) - (a.metrics?.executed ?? 0);
        }
        case "activities": return (b.metrics?.executed ?? 0) - (a.metrics?.executed ?? 0);
        case "cost": return (b.cost?.monthly ?? 0) - (a.cost?.monthly ?? 0);
        case "name": return a.name.localeCompare(b.name);
        default: return 0;
      }
    });
    return list;
  }, [orgList, healthFilter, sortBy, pinned]);

  return (
    <>
      <OrgHeader orgList={orgList} />
      {loading && <DashboardLoading />}
      {!loading && orgList.length === 0 && <EmptyState />}
      {!loading && orgList.length > 0 && (
        <>
          <FilterBar
            sortBy={sortBy}
            onSort={setSortBy}
            healthFilter={healthFilter}
            onHealth={setHealthFilter}
            count={visibleList.length}
            total={orgList.length}
          />
          <div className="dept-list">
            {visibleList.map((d: any) => (
              <DepartmentRow
                key={d.id}
                dept={d}
                expanded={expanded.has(d.id)}
                pinned={pinned.has(d.id)}
                onToggle={() => toggleExpand(d.id)}
                onPin={() => togglePin(d.id)}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function EmptyState() {
  const t = useTranslations("dashboard");
  return (
    <div style={{
      padding: 60, textAlign: "center", border: "1px dashed var(--border-strong)",
      borderRadius: "var(--radius-lg)", background: "var(--bg-elev)",
    }}>
      <h2 className="oh-title" style={{ fontSize: 24 }}>{t("empty_title")}</h2>
      <p style={{ color: "var(--text-muted)", marginTop: 12, marginBottom: 24 }}>
        {t("empty_sub")}
      </p>
      <a href="/skills?cmd=new-dept" className="oh-cta" style={{ display: "inline-flex" }}>
        + {t("create_first")}
      </a>
    </div>
  );
}

function DashboardLoading() {
  const t = useTranslations("dashboard");
  return (
    <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
      {t("loading_org")}
    </div>
  );
}
