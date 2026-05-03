"use client";

import { useEffect, useMemo, useState } from "react";

import "./home-v2.css";

// ===== User data (futuro: vem do contexto auth) =====
const data = {
  user: { name: "Wagner", role: "Operations builder", org: "Arctica" },
};

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
};

const SvgIcon = ({ name, ...rest }: any) => (
  <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" {...rest}>{Ico[name]}</svg>
);

function Sidebar({ collapsed, onToggle }: any) {
  const ops = [
    { id: "home", name: "Home", icon: "home", active: true, href: "/dashboard" },
    { id: "org", name: "Organization", icon: "org", href: "/dashboard" },
    { id: "agents", name: "Agents", icon: "agents", badge: "2,418", href: "/agents" },
    { id: "proc", name: "Processes", icon: "proc", badge: "14", href: "/tasks" },
    { id: "queue", name: "Queue", icon: "queue", badge: "5,532", href: "/tasks" },
  ];
  const config = [
    { id: "intg", name: "Integrations", icon: "intg", badge: "11", href: "/audit" },
    { id: "people", name: "People", icon: "people", badge: "42", href: "/approvals" },
    { id: "insights", name: "Insights", icon: "insights", href: "/audit" },
    { id: "set", name: "Settings", icon: "set", href: "/logout" },
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
  return (
    <div className="topbar">
      <div className="tb-search">
        <SvgIcon className="ico" name="search" />
        <span>Search agents, departments, processes…</span>
        <kbd>⌘ K</kbd>
      </div>
      <div className="tb-actions">
        <button className="tb-iconbtn" title="Toggle theme">
          <SvgIcon className="ico" name="theme" />
        </button>
        <button className="tb-iconbtn" title="Notifications">
          <SvgIcon className="ico" name="bell" />
          <span className="tb-iconbtn-dot" />
        </button>
        <a href="/logout" className="tb-iconbtn" title="Sair">
          <SvgIcon className="ico" name="set" />
        </a>
        <div className="tb-divider" />
        <button className="tb-account">
          <div className="tb-avatar">{data.user.name[0]}</div>
          <div className="tb-account-text">
            <div className="tb-account-name">{data.user.name}</div>
            <div className="tb-account-org">{data.user.org}</div>
          </div>
          <SvgIcon className="ico tb-account-chev" name="chev" />
        </button>
      </div>
    </div>
  );
}

function OrgHeader() {
  const totalAgents = ORG.reduce((s, d: any) => s + Object.values(d.agents).reduce((a: any, b: any) => a + b, 0), 0);
  const totalActive = ORG.reduce((s, d) => s + d.agents.active, 0);
  const totalCost = ORG.reduce((s, d) => s + d.cost.monthly, 0);
  return (
    <header className="org-header">
      <div className="oh-head">
        <div className="oh-eyebrow">Your digital workforce</div>
        <h1 className="oh-title">
          <span className="num">{ORG.length}</span> departments,&nbsp;
          <span className="num">{totalAgents.toLocaleString()}</span> digital employees on payroll.
        </h1>
      </div>
      <div className="oh-stats">
        <div className="oh-stat">
          <div className="oh-stat-l">Active right now</div>
          <div className="oh-stat-v">{totalActive.toLocaleString()}<span className="oh-stat-d"> / {totalAgents.toLocaleString()}</span></div>
        </div>
        <div className="oh-stat">
          <div className="oh-stat-l">Monthly cost</div>
          <div className="oh-stat-v">${(totalCost/1000).toFixed(1)}k</div>
        </div>
        <div className="oh-stat">
          <div className="oh-stat-l">Avg. SLA</div>
          <div className="oh-stat-v">99.0%</div>
        </div>
        <a className="oh-cta" href="/agents">
          <SvgIcon className="ico" name="plus" />
          New department
        </a>
      </div>
    </header>
  );
}

function DepartmentRow({ dept }: any) {
  const totalAgents = Object.values(dept.agents).reduce((a: any, b: any) => a + b, 0);
  const tiles = useMemo(() => buildAgentArray(dept.agents), [dept.id]);

  return (
    <section className={`dept dept--${dept.health}`}>
      <div className="dept-left">
        <div className="dept-id">
          <h2 className="dept-name">{dept.name}</h2>
          <div className={`dept-health dept-health--${dept.health}`}>
            <span className="dot" />
            {dept.health === "healthy" ? "On track" : "Needs attention"}
          </div>
          <a className="dept-edit" href={`/agents`} title="Edit department">
            <SvgIcon className="ico" name="edit" />
            Edit
          </a>
        </div>

        <div className="dept-meta">
          <div className="dm-row">
            <SvgIcon className="dm-icon" name="user" />
            <div>
              <div className="dm-l">Owner</div>
              <div className="dm-v"><strong>{dept.owner.name}</strong> · {dept.owner.role}</div>
            </div>
          </div>
          <div className="dm-row">
            <SvgIcon className="dm-icon" name="goal" />
            <div>
              <div className="dm-l">Objective</div>
              <div className="dm-v">{dept.objective}</div>
            </div>
          </div>
          <div className="dm-row">
            <SvgIcon className="dm-icon" name="cost" />
            <div>
              <div className="dm-l">Monthly cost</div>
              <div className="dm-v"><strong>${dept.cost.monthly.toLocaleString()}</strong> / month</div>
            </div>
          </div>
        </div>
      </div>

      <div className="dept-mid">
        <div className="dept-mid-label">Structure</div>
        <div className="teams">
          {dept.teams.map((t: any) => (
            <div key={t.name} className="team">
              <div className="team-name">{t.name}</div>
              <div className="roles">
                {t.roles.map((r: any) => (
                  <div key={r.name} className="role">
                    <span className="role-skill">{r.skill}</span>
                    <span className="role-name">{r.name}</span>
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
          <div className="dept-right-label">Workforce · {totalAgents as number} agents</div>
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
            <span className="dme-l">Registered</span>
            <span className="dme-v">{dept.metrics.registered.toLocaleString()}</span>
            <span className="dme-s">activities today</span>
          </div>
          <div className="dme">
            <span className="dme-l">Avg. handle</span>
            <span className="dme-v">{dept.metrics.avgHandle}</span>
            <span className="dme-s">per activity</span>
          </div>
          <div className="dme">
            <span className="dme-l">Error rate</span>
            <span className={`dme-v ${dept.metrics.errorPct > 2 ? "warn" : ""}`}>{dept.metrics.errorPct}%</span>
            <span className="dme-s">last 24h</span>
          </div>
        </div>

        <div className="dept-timeline">
          <div className="dt-head">
            <span className="dt-label">Activities executed · last 12h</span>
            <span className="dt-total">{dept.metrics.executed.toLocaleString()} done</span>
          </div>
          <Timeline data={dept.metrics.timeline} health={dept.health} />
        </div>
      </div>
    </section>
  );
}

function Timeline({ data, health }: any) {
  const w = 320, h = 36, max = Math.max(...data);
  const barW = (w - (data.length - 1) * 3) / data.length;
  const color = health === "attention" ? "var(--warning)" : "var(--accent)";
  return (
    <svg className="timeline-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      {data.map((v: number, i: number) => {
        const bh = (v / max) * (h - 2);
        return (
          <rect key={i} x={i * (barW + 3)} y={h - bh} width={barW} height={bh}
            fill={color} opacity={0.35 + (v / max) * 0.65} rx={1} />
        );
      })}
    </svg>
  );
}

export default function HomeV2Page() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = "light";
  }, []);

  return (
    <div className={`app ${collapsed ? "sidebar-collapsed" : ""}`}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c: boolean) => !c)} />
      <main>
        <TopBar />
        <div className="canvas">
          <OrgHeader />
          <div className="dept-list">
            {ORG.map(d => <DepartmentRow key={d.id} dept={d} />)}
          </div>
        </div>
      </main>
    </div>
  );
}
