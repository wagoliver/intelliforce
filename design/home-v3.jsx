// IntelliForce Home v3 — Departments collapsed by default, dossier on demand

const { useState, useEffect, useMemo, useCallback } = React;

const data = JSON.parse(document.getElementById("home-data").textContent);

// ===== Org structure (same shape as v2) =====
const ORG = [
  {
    id: "finance",
    name: "Finance",
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
    id: "procurement",
    name: "Procurement",
    owner: { name: "Marcos Vieira", role: "Procurement Director" },
    objective: "Categorize and route every PO within 60 seconds of receipt.",
    cost: { monthly: 19200, currency: "USD" },
    health: "healthy",
    teams: [
      { name: "PO operations", roles: [
        { name: "PO classifier", count: 22, skill: "CLS" },
        { name: "Vendor matcher", count: 14, skill: "VND" },
      ]},
      { name: "Contracts", roles: [
        { name: "Contract reviewer", count: 8, skill: "CON" },
      ]},
    ],
    agents: { active: 41, idle: 3, offline: 0, error: 0 },
    metrics: { registered: 8412, avgHandle: "0.8s", errorPct: 1.1, executed: 8180, timeline: [28,34,40,52,58,62,68,72,78,82,80,76] },
  },
  {
    id: "risk",
    name: "Risk & Compliance",
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
    id: "support",
    name: "Customer Support",
    owner: { name: "Pedro Lima", role: "Head of CX Operations" },
    objective: "Triage and resolve tier-1 tickets in under 90 seconds.",
    cost: { monthly: 22800, currency: "USD" },
    health: "healthy",
    teams: [
      { name: "Tier-1 triage", roles: [
        { name: "Ticket classifier", count: 18, skill: "TKT" },
        { name: "Auto-responder", count: 12, skill: "RSP" },
      ]},
      { name: "Knowledge ops", roles: [
        { name: "Article matcher", count: 8, skill: "KB" },
      ]},
    ],
    agents: { active: 32, idle: 6, offline: 0, error: 0 },
    metrics: { registered: 9876, avgHandle: "0.4s", errorPct: 0.3, executed: 9820, timeline: [68,72,78,82,86,88,92,94,90,86,82,78] },
  },
  {
    id: "hr",
    name: "HR Operations",
    owner: { name: "Camila Souza", role: "HR Operations Manager" },
    objective: "Onboard new hires and process payroll exceptions same-day.",
    cost: { monthly: 11400, currency: "USD" },
    health: "healthy",
    teams: [
      { name: "Onboarding", roles: [
        { name: "Document collector", count: 6, skill: "DOC" },
        { name: "Access provisioner", count: 4, skill: "ACS" },
      ]},
      { name: "Payroll exceptions", roles: [
        { name: "Payroll reviewer", count: 8, skill: "PAY" },
      ]},
    ],
    agents: { active: 14, idle: 4, offline: 0, error: 0 },
    metrics: { registered: 428, avgHandle: "5.2s", errorPct: 1.0, executed: 412, timeline: [22,28,34,32,30,36,40,38,34,30,26,24] },
  },
  {
    id: "it",
    name: "IT Operations",
    owner: { name: "Rodrigo Alves", role: "Director of IT" },
    objective: "Resolve 80% of L1 incidents without human intervention.",
    cost: { monthly: 16800, currency: "USD" },
    health: "healthy",
    teams: [
      { name: "Incident triage", roles: [
        { name: "Alert classifier", count: 12, skill: "ALT" },
        { name: "Runbook executor", count: 8, skill: "RUN" },
      ]},
      { name: "Access management", roles: [
        { name: "Access auditor", count: 6, skill: "ACS" },
      ]},
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

function AgentTile({ status = "active", size = 14 }) {
  const colors = {
    active: "var(--success)",
    idle: "var(--warning)",
    offline: "oklch(0.78 0.005 250)",
    error: "var(--danger)",
  };
  return (
    <div className="agent-tile" style={{ width: size, height: size, color: colors[status] }}>
      <svg viewBox="0 0 64 64">
        <path d="M10 10 H54 V54 H10 Z M22 22 V42 H42 V22 Z" fill="currentColor" fillRule="evenodd" />
      </svg>
    </div>
  );
}

function buildAgentArray({ active, idle, offline, error }) {
  const arr = [];
  for (let i = 0; i < active; i++) arr.push("active");
  for (let i = 0; i < idle; i++) arr.push("idle");
  for (let i = 0; i < offline; i++) arr.push("offline");
  for (let i = 0; i < error; i++) arr.push("error");
  return arr;
}

// ===== Icons =====
const Ico = {
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
  pin: <path d="M8 1.5l1.5 4 4 .6-3 2.8.7 4L8 11l-3.2 1.9.7-4-3-2.8 4-.6L8 1.5z" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round"/>,
  pinFilled: <path d="M8 1.5l1.5 4 4 .6-3 2.8.7 4L8 11l-3.2 1.9.7-4-3-2.8 4-.6L8 1.5z" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>,
};
const SvgIcon = ({ name, ...rest }) => (
  <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" {...rest}>{Ico[name]}</svg>
);

// ===== Sidebar =====
function Sidebar({ collapsed, onToggle }) {
  const ops = [
    { id: "home", name: "Home", icon: "home", active: true },
    { id: "org", name: "Organization", icon: "org" },
    { id: "agents", name: "Agents", icon: "agents", badge: "2,418" },
    { id: "proc", name: "Processes", icon: "proc", badge: "14" },
    { id: "queue", name: "Queue", icon: "queue", badge: "5,532" },
  ];
  const config = [
    { id: "intg", name: "Integrations", icon: "intg", badge: "11" },
    { id: "people", name: "People", icon: "people", badge: "42" },
    { id: "insights", name: "Insights", icon: "insights" },
    { id: "set", name: "Settings", icon: "set" },
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

function NavItem({ name, icon, badge, active, collapsed }) {
  return (
    <a className={`sb-item ${active ? "active" : ""}`} title={collapsed ? name : undefined}>
      <SvgIcon className="ico" name={icon} />
      {!collapsed && <span>{name}</span>}
      {!collapsed && badge && <span className="badge">{badge}</span>}
    </a>
  );
}

// ===== Top bar =====
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
        <button className="tb-iconbtn" title="Settings">
          <SvgIcon className="ico" name="set" />
        </button>
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

// ===== Org overview header =====
function OrgHeader() {
  const totalAgents = ORG.reduce((s, d) => s + Object.values(d.agents).reduce((a, b) => a + b, 0), 0);
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
        <a className="oh-cta" href="Department setup.html">
          <SvgIcon className="ico" name="plus" />
          New department
        </a>
      </div>
    </header>
  );
}

// ===== Filter bar =====
function FilterBar({ sortBy, onSort, healthFilter, onHealth, count, total }) {
  const sortOpts = [
    { id: "attention", label: "Attention first" },
    { id: "activities", label: "Activities ↓" },
    { id: "cost", label: "Cost ↓" },
    { id: "name", label: "A–Z" },
  ];
  const healthOpts = [
    { id: "all", label: "All" },
    { id: "healthy", label: "Healthy" },
    { id: "attention", label: "Attention" },
  ];
  return (
    <div className="filter-bar">
      <div className="fb-group">
        <span className="fb-label">Show</span>
        <div className="fb-pills">
          {healthOpts.map(o => (
            <button
              key={o.id}
              className={`fb-pill ${healthFilter === o.id ? "active" : ""}`}
              onClick={() => onHealth(o.id)}
            >{o.label}</button>
          ))}
        </div>
      </div>
      <div className="fb-group">
        <span className="fb-label">Sort by</span>
        <div className="fb-pills">
          {sortOpts.map(o => (
            <button
              key={o.id}
              className={`fb-pill ${sortBy === o.id ? "active" : ""}`}
              onClick={() => onSort(o.id)}
            >{o.label}</button>
          ))}
        </div>
      </div>
      <div className="fb-count">{count} of {total} departments</div>
    </div>
  );
}

// ===== Mini agent bar (proportional, replaces full grid in collapsed row) =====
function MiniAgentBar({ agents, total }) {
  const segs = [
    { key: "active", v: agents.active, color: "var(--success)" },
    { key: "idle", v: agents.idle, color: "var(--warning)" },
    { key: "offline", v: agents.offline, color: "oklch(0.82 0.005 250)" },
    { key: "error", v: agents.error, color: "var(--danger)" },
  ].filter(s => s.v > 0);
  return (
    <div className="mini-bar" title={`${agents.active} active · ${agents.idle} idle · ${agents.offline} offline · ${agents.error} error`}>
      {segs.map(s => (
        <div
          key={s.key}
          className="mini-bar-seg"
          style={{ flex: s.v, background: s.color }}
        />
      ))}
    </div>
  );
}

// ===== Sparkline =====
function Sparkline({ data: pts, health, height = 28, width = 140 }) {
  const max = Math.max(...pts);
  const barW = (width - (pts.length - 1) * 2) / pts.length;
  const color = health === "attention" ? "var(--warning)" : "var(--accent)";
  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width, height }}>
      {pts.map((v, i) => {
        const bh = Math.max(2, (v / max) * (height - 2));
        return (
          <rect
            key={i}
            x={i * (barW + 2)} y={height - bh}
            width={barW} height={bh}
            fill={color}
            opacity={0.35 + (v / max) * 0.65}
            rx={1}
          />
        );
      })}
    </svg>
  );
}

// Larger timeline for the expanded panel
function Timeline({ data: pts, health }) {
  const w = 320, h = 36, max = Math.max(...pts);
  const barW = (w - (pts.length - 1) * 3) / pts.length;
  const color = health === "attention" ? "var(--warning)" : "var(--accent)";
  return (
    <svg className="timeline-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      {pts.map((v, i) => {
        const bh = (v / max) * (h - 2);
        return (
          <rect
            key={i}
            x={i * (barW + 3)} y={h - bh}
            width={barW} height={bh}
            fill={color}
            opacity={0.35 + (v / max) * 0.65}
            rx={1}
          />
        );
      })}
    </svg>
  );
}

// ===== Department: collapsed row + expanded dossier =====
function DepartmentRow({ dept, expanded, onToggle, pinned, onPin }) {
  const totalAgents = Object.values(dept.agents).reduce((a, b) => a + b, 0);
  const tiles = useMemo(() => buildAgentArray(dept.agents), [dept.id]);
  const healthLabel = dept.health === "healthy" ? "On track" : "Needs attention";

  return (
    <section className={`dept-row ${expanded ? "is-open" : ""} ${pinned ? "is-pinned" : ""} dept--${dept.health}`}>
      {/* Row header — always visible */}
      <button className="dept-row-head" onClick={onToggle} aria-expanded={expanded}>
        <div className="drh-mark"><BrandMark /></div>

        <div className="drh-name">
          <div className="drh-name-row">
            <span className="dept-name-compact">{dept.name}</span>
            {dept.agents.error > 0 && <span className="drh-error-pip">{dept.agents.error} err</span>}
          </div>
          <div className={`dept-health dept-health--${dept.health}`}>
            <span className="dot" /> {healthLabel}
          </div>
        </div>

        <div className="drh-owner">
          <SvgIcon className="ico" name="user" />
          <div>
            <div className="drh-owner-name">{dept.owner.name}</div>
            <div className="drh-owner-role">{dept.owner.role}</div>
          </div>
        </div>

        <div className="drh-bar">
          <MiniAgentBar agents={dept.agents} total={totalAgents} />
          <span className="drh-bar-count">
            <strong>{dept.agents.active}</strong>
            <span className="muted"> / {totalAgents} active</span>
          </span>
        </div>

        <div className="drh-kpi">
          <div className="drh-kpi-text">
            <div className="drh-kpi-v">{(dept.metrics.executed / 1000).toFixed(1)}k</div>
            <div className="drh-kpi-l">activities · 12h</div>
          </div>
          <Sparkline data={dept.metrics.timeline} health={dept.health} />
        </div>

        <div className="drh-actions">
          <span
            className={`drh-pin ${pinned ? "is-pinned" : ""}`}
            onClick={(e) => { e.stopPropagation(); onPin(); }}
            title={pinned ? "Unpin" : "Pin to top"}
          >
            <SvgIcon className="ico" name={pinned ? "pinFilled" : "pin"} />
          </span>
          <span className="drh-chev"><SvgIcon className="ico" name="chev" /></span>
        </div>
      </button>

      {/* Expanded dossier — same 3-column layout as v2 */}
      {expanded && (
        <div className="dept-dossier">
          <div className="dept-left">
            <div className="dept-meta">
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
            <a className="dept-edit-btn" href={`Department setup.html?id=${dept.id}`}>
              <SvgIcon className="ico" name="edit" />
              Edit department
            </a>
          </div>

          <div className="dept-mid">
            <div className="dept-mid-label">Structure</div>
            <div className="teams">
              {dept.teams.map(t => (
                <div key={t.name} className="team">
                  <div className="team-name">{t.name}</div>
                  <div className="roles">
                    {t.roles.map(r => (
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
              <div className="dept-right-label">Workforce · {totalAgents} agents</div>
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
        </div>
      )}
    </section>
  );
}

// ===== App =====
function App() {
  const [collapsed, setCollapsed] = useState(false);

  // Auto-expand any dept that needs attention or has errors
  const initialExpanded = useMemo(() => {
    const s = new Set();
    ORG.forEach(d => {
      if (d.health === "attention" || d.agents.error > 0) s.add(d.id);
    });
    return s;
  }, []);
  const [expanded, setExpanded] = useState(initialExpanded);
  const [pinned, setPinned] = useState(new Set());
  const [sortBy, setSortBy] = useState("attention");
  const [healthFilter, setHealthFilter] = useState("all");

  const toggleExpand = useCallback((id) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const togglePin = useCallback((id) => {
    setPinned(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        // pinning also expands
        setExpanded(p => new Set(p).add(id));
      }
      return next;
    });
  }, []);

  const filtered = useMemo(() => {
    let list = ORG;
    if (healthFilter !== "all") list = list.filter(d => d.health === healthFilter);
    list = [...list].sort((a, b) => {
      // pinned always first
      const ap = pinned.has(a.id), bp = pinned.has(b.id);
      if (ap !== bp) return ap ? -1 : 1;
      switch (sortBy) {
        case "attention": {
          const order = { attention: 0, healthy: 1 };
          if (a.health !== b.health) return order[a.health] - order[b.health];
          return b.metrics.executed - a.metrics.executed;
        }
        case "activities": return b.metrics.executed - a.metrics.executed;
        case "cost": return b.cost.monthly - a.cost.monthly;
        case "name": return a.name.localeCompare(b.name);
        default: return 0;
      }
    });
    return list;
  }, [sortBy, healthFilter, pinned]);

  return (
    <div className={`app ${collapsed ? "sidebar-collapsed" : ""}`}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <main>
        <TopBar />
        <div className="canvas">
          <OrgHeader />
          <FilterBar
            sortBy={sortBy} onSort={setSortBy}
            healthFilter={healthFilter} onHealth={setHealthFilter}
            count={filtered.length} total={ORG.length}
          />
          <div className="dept-list">
            {filtered.map(d => (
              <DepartmentRow
                key={d.id}
                dept={d}
                expanded={expanded.has(d.id)}
                onToggle={() => toggleExpand(d.id)}
                pinned={pinned.has(d.id)}
                onPin={() => togglePin(d.id)}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
