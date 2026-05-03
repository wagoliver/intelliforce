"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { UserMenu } from "@/components/user-menu";
import { departments as deptsApi, type DepartmentOut } from "@/lib/api/departments";
import { metrics as metricsApi, formatHandle, type DepartmentMetricsOut, type TaskHistoryItem, type TimelineBucket, type RecentExecution } from "@/lib/api/metrics";

import "./home-v2.css";

// ===== User data (futuro: vem do contexto auth) =====
const data = {
  user: { name: "Wagner", role: "Operations builder", org: "Arctica" },
};

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
    owner: { name: "—", role: "" },
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

// ===== Org structure (mock data fiel ao protótipo) =====
const ORG = [
  {
    id: "finance", name: "Finance",
    owner: { name: "Daniela Reis", role: "Head of Finance Ops" },
    objective: "Process 100% of AP invoices in under 5 minutes, end-to-end.",
    cost: { monthly: 28400, currency: "USD" },
    health: "healthy",
    teams: [
      { name: "Accounts Payable", roles: [
        { name: "Invoice validator", count: 24, skill: "VAL" },
        { name: "PO matcher", count: 18, skill: "MAT" },
        { name: "Payment scheduler", count: 8, skill: "SCH" },
      ]},
      { name: "Tax & Compliance", roles: [
        { name: "Tax reconciler", count: 12, skill: "REC" },
        { name: "Audit sampler", count: 6, skill: "AUD" },
      ]},
      { name: "Expense audit", roles: [
        { name: "Expense auditor", count: 14, skill: "EXP" },
      ]},
    ],
    agents: { active: 68, idle: 10, offline: 4, error: 0 },
    metrics: { registered: 13208, avgHandle: "2.1s", errorPct: 0.6, executed: 12402, timeline: [42,48,55,62,58,68,74,82,88,92,86,90] },
  },
  {
    id: "procurement", name: "Procurement",
    owner: { name: "Marcos Vieira", role: "Procurement Director" },
    objective: "Categorize and route every PO within 60 seconds of receipt.",
    cost: { monthly: 19200, currency: "USD" },
    health: "healthy",
    teams: [
      { name: "PO operations", roles: [
        { name: "PO classifier", count: 22, skill: "CLS" },
        { name: "Vendor matcher", count: 14, skill: "VND" },
      ]},
      { name: "Contracts", roles: [{ name: "Contract reviewer", count: 8, skill: "CON" }]},
    ],
    agents: { active: 41, idle: 3, offline: 0, error: 0 },
    metrics: { registered: 8412, avgHandle: "0.8s", errorPct: 1.1, executed: 8180, timeline: [28,34,40,52,58,62,68,72,78,82,80,76] },
  },
  {
    id: "risk", name: "Risk & Compliance",
    owner: { name: "Yara Mendes", role: "Chief Risk Officer" },
    objective: "Refresh KYC on 100% of customer base every 90 days.",
    cost: { monthly: 34600, currency: "USD" },
    health: "attention",
    teams: [
      { name: "KYC", roles: [
        { name: "KYC checker", count: 28, skill: "KYC" },
        { name: "Document validator", count: 16, skill: "DOC" },
      ]},
      { name: "Anti-fraud", roles: [
        { name: "Anomaly detector", count: 12, skill: "ANO" },
        { name: "Transaction reviewer", count: 10, skill: "TXN" },
      ]},
    ],
    agents: { active: 58, idle: 6, offline: 0, error: 2 },
    metrics: { registered: 7128, avgHandle: "3.4s", errorPct: 2.6, executed: 6945, timeline: [55,52,48,42,38,42,48,52,56,62,64,60] },
  },
  {
    id: "support", name: "Customer Support",
    owner: { name: "Pedro Lima", role: "Head of CX Operations" },
    objective: "Triage and resolve tier-1 tickets in under 90 seconds.",
    cost: { monthly: 22800, currency: "USD" },
    health: "healthy",
    teams: [
      { name: "Tier-1 triage", roles: [
        { name: "Ticket classifier", count: 18, skill: "TKT" },
        { name: "Auto-responder", count: 12, skill: "RSP" },
      ]},
      { name: "Knowledge ops", roles: [{ name: "Article matcher", count: 8, skill: "KB" }]},
    ],
    agents: { active: 32, idle: 6, offline: 0, error: 0 },
    metrics: { registered: 9876, avgHandle: "0.4s", errorPct: 0.3, executed: 9820, timeline: [68,72,78,82,86,88,92,94,90,86,82,78] },
  },
  {
    id: "hr", name: "HR Operations",
    owner: { name: "Camila Souza", role: "HR Operations Manager" },
    objective: "Onboard new hires and process payroll exceptions same-day.",
    cost: { monthly: 11400, currency: "USD" },
    health: "healthy",
    teams: [
      { name: "Onboarding", roles: [
        { name: "Document collector", count: 6, skill: "DOC" },
        { name: "Access provisioner", count: 4, skill: "ACS" },
      ]},
      { name: "Payroll exceptions", roles: [{ name: "Payroll reviewer", count: 8, skill: "PAY" }]},
    ],
    agents: { active: 14, idle: 4, offline: 0, error: 0 },
    metrics: { registered: 428, avgHandle: "5.2s", errorPct: 1.0, executed: 412, timeline: [22,28,34,32,30,36,40,38,34,30,26,24] },
  },
  {
    id: "it", name: "IT Operations",
    owner: { name: "Rodrigo Alves", role: "Director of IT" },
    objective: "Resolve 80% of L1 incidents without human intervention.",
    cost: { monthly: 16800, currency: "USD" },
    health: "healthy",
    teams: [
      { name: "Incident triage", roles: [
        { name: "Alert classifier", count: 12, skill: "ALT" },
        { name: "Runbook executor", count: 8, skill: "RUN" },
      ]},
      { name: "Access management", roles: [{ name: "Access auditor", count: 6, skill: "ACS" }]},
    ],
    agents: { active: 24, idle: 2, offline: 0, error: 0 },
    metrics: { registered: 3192, avgHandle: "1.1s", errorPct: 0.8, executed: 3148, timeline: [38,42,48,54,58,62,66,68,64,60,56,52] },
  },
];

// ===== Brand mark =====
const BrandMark = () => (
  <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 10 H54 V54 H10 Z M22 22 V42 H42 V22 Z" fill="currentColor" fillRule="evenodd" />
  </svg>
);

function AgentTile({ status = "active", size = 14, skill }: any) {
  const colors: any = {
    active: "var(--success)",
    idle: "var(--warning)",
    offline: "oklch(0.78 0.005 250)",
    error: "var(--danger)",
  };
  return (
    <div className="agent-tile" style={{ width: size, height: size, color: colors[status] }} title={`${skill || "agent"} · ${status}`}>
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
};

const SvgIcon = ({ name, ...rest }: any) => (
  <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" {...rest}>{Ico[name]}</svg>
);

function Sidebar({ collapsed, onToggle }: any) {
  const t = useTranslations("nav");
  const ops = [
    { id: "home", name: t("home"), icon: "home", active: true, href: "/dashboard" },
    { id: "org", name: t("organization"), icon: "org", href: "/dashboard" },
    { id: "agents", name: t("agents"), icon: "agents", href: "/agents" },
    { id: "proc", name: t("processes"), icon: "proc", href: "/tasks" },
    { id: "queue", name: t("queue"), icon: "queue", href: "/tasks" },
  ];
  const config = [
    { id: "intg", name: t("integrations"), icon: "intg", href: "/audit" },
    { id: "people", name: t("people"), icon: "people", href: "/approvals" },
    { id: "insights", name: t("insights"), icon: "insights", href: "/audit" },
    { id: "set", name: t("settings"), icon: "set", href: "/setup" },
  ];
  return (
    <aside className={`sidebar ${collapsed ? "is-collapsed" : ""}`}>
      <div className="sb-brand">
        <div className="sb-brand-mark"><BrandMark /></div>
        {!collapsed && <div className="sb-brand-name">IntelliForce</div>}
        <button className="sb-toggle" onClick={onToggle} title={collapsed ? "Expand menu" : "Collapse menu"}>
          <SvgIcon className="ico" name={collapsed ? "menuRight" : "menuLeft"} />
        </button>
      </div>
      {!collapsed && <div className="sb-org">{data.user.org}</div>}

      <nav className="sb-nav">
        {ops.map(i => <NavItem key={i.id} {...i} collapsed={collapsed} />)}
        {!collapsed && <div className="sb-section-label">Configure</div>}
        {collapsed && <div className="sb-divider" />}
        {config.map(i => <NavItem key={i.id} {...i} collapsed={collapsed} />)}
      </nav>
    </aside>
  );
}

function NavItem({ name, icon, badge, active, collapsed, href }: any) {
  return (
    <a href={href} className={`sb-item ${active ? "active" : ""}`} title={collapsed ? name : undefined}>
      <SvgIcon className="ico" name={icon} />
      {!collapsed && <span>{name}</span>}
      {!collapsed && badge && <span className="badge">{badge}</span>}
    </a>
  );
}

function TopBar() {
  const tc = useTranslations("common");
  const tn = useTranslations("nav");
  return (
    <div className="topbar">
      <div className="tb-search">
        <SvgIcon className="ico" name="search" />
        <span>{tc("search_placeholder")}</span>
        <kbd>⌘ K</kbd>
      </div>
      <div className="tb-actions">
        <button className="tb-iconbtn" title={tn("toggle_theme")}>
          <SvgIcon className="ico" name="theme" />
        </button>
        <button className="tb-iconbtn" title={tn("notifications")}>
          <SvgIcon className="ico" name="bell" />
          <span className="tb-iconbtn-dot" />
        </button>
        <div className="tb-divider" />
        <UserMenu userName={data.user.name} userOrg={data.user.org} userRole={data.user.role} />
      </div>
    </div>
  );
}

function OrgHeader({ orgList }: { orgList: any[] }) {
  const t = useTranslations("dashboard");
  const totalAgents = orgList.reduce((s, d: any) => s + Object.values(d.agents).reduce((a: any, b: any) => a + b, 0), 0);
  const totalActive = orgList.reduce((s, d) => s + d.agents.active, 0);
  const totalCost = orgList.reduce((s, d) => s + d.cost.monthly, 0);
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
          <div className="oh-stat-v">99.0%</div>
        </div>
        <a className="oh-cta" href="/setup">
          <SvgIcon className="ico" name="plus" />
          {t("new_department")}
        </a>
      </div>
    </header>
  );
}

function DepartmentRow({ dept }: any) {
  const t = useTranslations("dashboard");
  const totalAgents = Object.values(dept.agents).reduce((a: any, b: any) => a + b, 0);
  const tiles = useMemo(() => buildAgentArray(dept.agents), [dept.id]);
  const [history, setHistory] = useState(null as TaskHistoryItem[] | null);

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
    <section className={`dept dept--${dept.health}`}>
      <div className="dept-left">
        <div className="dept-id">
          <h2 className="dept-name">{dept.name}</h2>
          <div className={`dept-health dept-health--${dept.health}`}>
            <span className="dot" />
            {dept.health === "healthy" ? t("on_track") : t("needs_attention")}
          </div>
          <a className="dept-edit" href={`/setup`} title={t("edit")}>
            <SvgIcon className="ico" name="edit" />
            {t("edit")}
          </a>
        </div>

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
        </div>
          <Timeline data={dept.metrics.timeline} health={dept.health} />
        </div>
      </div>
    </section>
  );
}

function HistorySection({ history }: { history: any }) {
  const t = useTranslations("dashboard");
  if (history === null) return null;
  return (
    <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
      <div style={{
        fontSize: 11, color: "var(--text-subtle)", letterSpacing: "0.06em",
        textTransform: "uppercase", fontWeight: 600, marginBottom: 8,
      }}>
        {t("history_title")} ({history.length})
      </div>
      {history.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "4px 0" }}>
          {t("history_empty")}
        </div>
      ) : (
        <div style={{ maxHeight: 180, overflow: "auto", display: "grid", gap: 4 }}>
          {history.map((h) => (
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
              <span style={{ color: "var(--text-subtle)", fontFamily: "var(--font-mono)" }}>
                {h.duration_seconds != null ? `${h.duration_seconds.toFixed(1)}s` : "—"}
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
    completed: "var(--success)",
    running: "var(--accent)",
    pending: "var(--text-subtle)",
    awaiting_approval: "var(--warning)",
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
  const [items, setItems] = useState([] as RecentExecution[]);

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
    completed: "var(--success)",
    failed: "var(--danger)",
    running: "var(--accent)",
    pending: "var(--text-subtle)",
    cancelled: "var(--text-subtle)",
    awaiting_approval: "var(--warning)",
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
  const [collapsed, setCollapsed] = useState(false);
  const [orgData, setOrgData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);

  // Tema vem do cookie, aplicado em layout.tsx — não forçar aqui

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const list = await deptsApi.list();
        // Busca métricas reais de cada department em paralelo
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

  const orgList = orgData ?? [];

  return (
    <div className={`app ${collapsed ? "sidebar-collapsed" : ""}`}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c: boolean) => !c)} />
      <main>
        <TopBar />
        <div className="canvas">
          <OrgHeader orgList={orgList} />
          {loading && <DashboardLoading />}
          {!loading && orgList.length === 0 && (
            <EmptyState />
          )}
          {!loading && orgList.length > 0 && (
            <div className="dept-list">
              {orgList.map((d: any) => <DepartmentRow key={d.id} dept={d} />)}
            </div>
          )}
        </div>
      </main>
    </div>
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
      <a href="/setup" className="oh-cta" style={{ display: "inline-flex" }}>
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
