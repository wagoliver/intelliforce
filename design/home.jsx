// IntelliForce Home — calm editorial command panel for builders

const { useState, useEffect, useMemo } = React;

const data = JSON.parse(document.getElementById("home-data").textContent);

// ===== Icons =====
const Ico = {
  home: <path d="M3 9.5l5-5 5 5V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round"/>,
  agents: <g stroke="currentColor" strokeWidth="1.4" fill="none"><circle cx="8" cy="6" r="2.5"/><path d="M3 13.5c0-2.2 2.2-4 5-4s5 1.8 5 4"/></g>,
  proc: <g stroke="currentColor" strokeWidth="1.4" fill="none"><rect x="2.5" y="3" width="4" height="4" rx="0.5"/><rect x="9.5" y="3" width="4" height="4" rx="0.5"/><rect x="6" y="9" width="4" height="4" rx="0.5"/><path d="M4.5 7v1M11.5 7v1M6 11h-1.5v-3M10 11h1.5v-3"/></g>,
  queue: <g stroke="currentColor" strokeWidth="1.4" fill="none"><rect x="2.5" y="3" width="11" height="2.5" rx="0.5"/><rect x="2.5" y="6.75" width="11" height="2.5" rx="0.5"/><rect x="2.5" y="10.5" width="11" height="2.5" rx="0.5"/></g>,
  skills: <g stroke="currentColor" strokeWidth="1.4" fill="none"><path d="M8 2.5l1.6 3.4 3.6.5-2.6 2.5.6 3.6L8 10.7l-3.2 1.8.6-3.6L2.8 6.4l3.6-.5L8 2.5z"/></g>,
  intg: <g stroke="currentColor" strokeWidth="1.4" fill="none"><path d="M5 3v3h-2v4h2v3M11 3v3h2v4h-2v3"/></g>,
  people: <g stroke="currentColor" strokeWidth="1.4" fill="none"><circle cx="6" cy="6" r="2"/><circle cx="11" cy="6" r="1.5"/><path d="M2.5 13c0-1.8 1.5-3.2 3.5-3.2s3.5 1.4 3.5 3.2M9.5 13c0-1.4 1-2.5 2-2.5s2 1.1 2 2.5"/></g>,
  insights: <g stroke="currentColor" strokeWidth="1.4" fill="none"><path d="M3 13V8M7 13V4M11 13V10"/></g>,
  set: <g stroke="currentColor" strokeWidth="1.4" fill="none"><circle cx="8" cy="8" r="2"/><path d="M8 1.5v1.5M8 13v1.5M14.5 8H13M3 8H1.5M12.5 3.5l-1 1M4.5 11.5l-1 1M12.5 12.5l-1-1M4.5 4.5l-1-1"/></g>,
  search: <g stroke="currentColor" strokeWidth="1.4" fill="none"><circle cx="6.5" cy="6.5" r="3.5"/><path d="M9 9l3 3"/></g>,
  bell: <g stroke="currentColor" strokeWidth="1.4" fill="none"><path d="M4 11V7a4 4 0 0 1 8 0v4l1 1H3l1-1zM7 13h2"/></g>,
  plus: <g stroke="currentColor" strokeWidth="1.5" fill="none"><path d="M8 3v10M3 8h10"/></g>,
  arrow: <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.4" fill="none"/>,
  ext: <g stroke="currentColor" strokeWidth="1.4" fill="none"><path d="M9 3h4v4M13 3l-6 6"/></g>,
  theme: <g stroke="currentColor" strokeWidth="1.4" fill="none"><path d="M11 8.5A4 4 0 0 1 7.5 4 a4 4 0 1 0 3.5 4.5z"/></g>,
  chev: <path d="M5 7l3 3 3-3" stroke="currentColor" strokeWidth="1.4" fill="none"/>,
  warn: <g stroke="currentColor" strokeWidth="1.4" fill="none"><path d="M8 2.5L14 13H2L8 2.5z"/><path d="M8 7v3M8 11.5v0.5"/></g>,
  ocr: <g stroke="currentColor" strokeWidth="1.4" fill="none"><rect x="2.5" y="3.5" width="11" height="9" rx="1"/><path d="M2.5 8h11M5 6h2M5 10h6"/></g>,
  brain: <g stroke="currentColor" strokeWidth="1.4" fill="none"><path d="M5.5 4.5C4 4.5 3 5.5 3 7s1 2.5 2 2.5v2c0 1 1 1.5 2 1.5h2c1 0 2-.5 2-1.5v-2c1 0 2-1 2-2.5S12 4.5 10.5 4.5"/><path d="M5.5 4.5c0-1 1-2 2.5-2s2.5 1 2.5 2"/></g>,
  validate: <g stroke="currentColor" strokeWidth="1.4" fill="none"><path d="M3 8.5l3.5 3.5L13 4"/></g>,
  classify: <g stroke="currentColor" strokeWidth="1.4" fill="none"><rect x="2.5" y="2.5" width="5" height="5" rx="0.5"/><rect x="8.5" y="2.5" width="5" height="5" rx="0.5"/><rect x="2.5" y="8.5" width="5" height="5" rx="0.5"/><rect x="8.5" y="8.5" width="5" height="5" rx="0.5"/></g>,
  notch: <path d="M2 2 H14 V14 H2 Z M5 5 V11 H11 V5 Z" fill="currentColor" fillRule="evenodd"/>,
};

const SvgIcon = ({ name, ...rest }) => (
  <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" {...rest}>{Ico[name]}</svg>
);

const BrandMark = () => (
  <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 10 H54 V54 H10 Z M22 22 V42 H42 V22 Z" fill="currentColor" fillRule="evenodd" />
  </svg>
);

// ===== Sidebar =====
function Sidebar() {
  const items = [
    { id: "home", name: "Home", icon: "home", active: true },
  ];
  const ops = [
    { id: "agents", name: "Agents", icon: "agents", badge: "2,418" },
    { id: "proc", name: "Processes", icon: "proc", badge: "14" },
    { id: "queue", name: "Queue", icon: "queue", badge: "5,532" },
    { id: "skills", name: "Skills", icon: "skills", badge: "28" },
  ];
  const config = [
    { id: "intg", name: "Integrations", icon: "intg", badge: "11" },
    { id: "people", name: "People", icon: "people", badge: "42" },
    { id: "insights", name: "Insights", icon: "insights" },
    { id: "set", name: "Settings", icon: "set" },
  ];
  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <div className="sb-brand-mark"><BrandMark /></div>
        <div className="sb-brand-name">IntelliForce</div>
      </div>
      <div className="sb-org">{data.user.org}</div>

      <nav className="sb-nav">
        {items.map(i => <NavItem key={i.id} {...i} />)}

        <div className="sb-section-label">Operation</div>
        {ops.map(i => <NavItem key={i.id} {...i} />)}

        <div className="sb-section-label">Configure</div>
        {config.map(i => <NavItem key={i.id} {...i} />)}
      </nav>

      <div className="sb-foot">
        <div className="sb-avatar">{data.user.name[0]}</div>
        <div>
          <div className="sb-user-name">{data.user.name}</div>
          <div className="sb-user-role">{data.user.role}</div>
        </div>
      </div>
    </aside>
  );
}

function NavItem({ name, icon, badge, active }) {
  return (
    <a className={`sb-item ${active ? "active" : ""}`}>
      <SvgIcon className="ico" name={icon} />
      <span>{name}</span>
      {badge && <span className="badge">{badge}</span>}
    </a>
  );
}

// ===== Top bar =====
function TopBar() {
  return (
    <div className="topbar">
      <div className="tb-search">
        <SvgIcon className="ico" name="search" />
        <span>Search agents, processes, queues…</span>
        <kbd>⌘ K</kbd>
      </div>
      <div className="tb-actions">
        <button className="tb-iconbtn" title="Toggle theme" onClick={() => {
          const r = document.documentElement;
          r.dataset.theme = r.dataset.theme === "dark" ? "light" : "dark";
        }}>
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

// ===== Greeting =====
function Greeting({ variant }) {
  return (
    <header className="greeting">
      <div>
        <div className="g-eyebrow"><span className="g-dot" /> Operation healthy · all SLAs on track</div>
        <h1 className="g-title">
          Your workforce is <span className="accent">running smoothly</span>.
        </h1>
      </div>
      <div className="g-meta">
        <div><strong>09:42</strong> · São Paulo</div>
        <div>v 4.2.1</div>
      </div>
    </header>
  );
}

// ===== Workforce status =====
function Workforce() {
  const top = [
    { name: "invoice-validator-04", meta: "Finance · 42 tasks/min" },
    { name: "po-classifier-12", meta: "Procurement · 38 tasks/min" },
    { name: "ticket-triage-07", meta: "Support · 31 tasks/min" },
  ];
  const idle = [
    { name: "month-end-close-02", meta: "Scheduled · 18:00" },
    { name: "tax-recon-01", meta: "Waiting on input" },
    { name: "audit-sampler-03", meta: "Idle · 4 min" },
  ];
  const off = [
    { name: "legacy-payroll-09", meta: "Maintenance" },
    { name: "test-bench-01", meta: "Disabled" },
  ];
  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">Workforce</h2>
        <a className="section-link" href="#">All 2,418 agents <SvgIcon style={{width:11,height:11}} name="arrow" /></a>
      </div>
      <div className="workforce">
        <WfCol kind="active" label="Active" num={data.agentTotals.active} pct="76% of workforce" list={top} />
        <WfCol kind="idle" label="Idle" num={data.agentTotals.idle} pct="16% of workforce" list={idle} />
        <WfCol kind="offline" label="Offline" num={data.agentTotals.offline} pct="8% of workforce" list={off} />
      </div>
    </section>
  );
}
function WfCol({ kind, label, num, pct, list }) {
  return (
    <div className="wf-col">
      <div className={`wf-label ${kind}`}><span className="ldot" /> {label}</div>
      <div className="wf-num">{num.toLocaleString()}<span className="small"> agents</span></div>
      <div className="wf-pct">{pct}</div>
      <div className="wf-list">
        {list.map(i => (
          <div key={i.name} className="wf-list-item">
            <span className="wf-list-name">{i.name}</span>
            <span className="wf-list-meta">{i.meta}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== Activity now =====
function ActivityNow() {
  const events = [
    { t: "09:42", agent: "invoice-validator-04", action: "approved batch #2941", tag: "Finance" },
    { t: "09:42", agent: "po-classifier-12", action: "routed 18 POs to category G", tag: "Procurement" },
    { t: "09:41", agent: "ticket-triage-07", action: "escalated 3 tickets to Tier 2", tag: "Support" },
    { t: "09:41", agent: "kyc-checker-02", action: "validated 47 customer records", tag: "Risk" },
    { t: "09:40", agent: "expense-auditor-01", action: "flagged 2 anomalies for review", tag: "Finance" },
  ];
  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">Activity now</h2>
        <a className="section-link" href="#">Live feed <SvgIcon style={{width:11,height:11}} name="arrow" /></a>
      </div>
      <div className="activity">
        <div>
          <h3 className="act-headline">
            <span className="num">{data.throughput.tasksPerMin.toLocaleString()}</span> tasks per minute,<br/>
            steady through the morning.
          </h3>
          <p className="act-sub">
            Your digital workforce has automated <strong>{data.throughput.hoursAutomated.toLocaleString()} hours</strong> of repetitive work this week — equivalent to ~115 FTEs freed for higher-value tasks.
          </p>
          <div className="act-stats">
            <div className="act-stat">
              <div className="act-stat-l">SLA met</div>
              <div className="act-stat-v">{data.throughput.slaMet}%<span className="act-stat-d">↑ 0.3</span></div>
            </div>
            <div className="act-stat">
              <div className="act-stat-l">Avg. handle</div>
              <div className="act-stat-v">2.4s<span className="act-stat-d">↓ 0.2</span></div>
            </div>
            <div className="act-stat">
              <div className="act-stat-l">Processes live</div>
              <div className="act-stat-v">14</div>
            </div>
          </div>
        </div>

        <div className="act-feed">
          {events.map((e, i) => (
            <div key={i} className="feed-row">
              <span className="feed-time">{e.t}</span>
              <span className="feed-text"><span className="agent">{e.agent}</span> {e.action}</span>
              <span className="feed-tag">{e.tag}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===== Queue =====
function MiniSpark({ data: pts, color = "var(--accent)" }) {
  const w = 200, h = 32, max = Math.max(...pts);
  const path = pts.map((v, i) => {
    const x = (i / (pts.length - 1)) * w;
    const y = h - (v / max) * (h - 4) - 2;
    return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg className="q-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path d={path} stroke={color} strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function Queue() {
  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">Queue</h2>
        <a className="section-link" href="#">Queue manager <SvgIcon style={{width:11,height:11}} name="arrow" /></a>
      </div>
      <div className="queue">
        <div className="q-card">
          <div className="q-head"><span className="q-label">In progress</span><span className="q-trend good">↑ 4.2%</span></div>
          <div className="q-num">{data.queue.inProgress.toLocaleString()}</div>
          <MiniSpark data={[12, 18, 15, 22, 28, 24, 30, 32, 28, 34, 36, 38]} />
        </div>
        <div className="q-card">
          <div className="q-head"><span className="q-label">Scheduled</span><span className="q-trend">next 24h</span></div>
          <div className="q-num">{data.queue.scheduled.toLocaleString()}</div>
          <MiniSpark data={[8, 14, 12, 18, 16, 14, 22, 18, 14, 12, 10, 8]} color="var(--text-subtle)" />
        </div>
        <div className="q-card exception">
          <div className="q-head"><span className="q-label">Exceptions awaiting review</span><span className="q-trend warn">human input</span></div>
          <div className="q-num">{data.queue.exceptions}</div>
          <a className="q-action" href="#">Review queue <SvgIcon style={{width:11,height:11}} name="arrow" /></a>
        </div>
      </div>
    </section>
  );
}

// ===== Top processes =====
function Processes() {
  const rows = [
    { name: "AP invoice triage", meta: "Finance · 8 agents", load: 92, sla: "99.4%", lead: "1m 12s", status: "healthy" },
    { name: "PO categorization", meta: "Procurement · 6 agents", load: 78, sla: "98.9%", lead: "0m 48s", status: "healthy" },
    { name: "Customer KYC refresh", meta: "Risk · 12 agents", load: 84, sla: "99.1%", lead: "2m 04s", status: "healthy" },
    { name: "Expense audit", meta: "Finance · 4 agents", load: 56, sla: "97.2%", lead: "3m 18s", status: "attention" },
    { name: "Support tier-1 triage", meta: "Support · 9 agents", load: 88, sla: "99.7%", lead: "0m 22s", status: "healthy" },
  ];
  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">Top processes</h2>
        <a className="section-link" href="#">All 14 processes <SvgIcon style={{width:11,height:11}} name="arrow" /></a>
      </div>
      <div className="proc-table">
        {rows.map(r => (
          <div key={r.name} className="proc-row">
            <div className="proc-name">
              <span className="proc-title">{r.name}</span>
              <span className="proc-meta">{r.meta}</span>
            </div>
            <div className="proc-bar-wrap">
              <div className="proc-bar"><div className="proc-bar-fill" style={{ width: `${r.load}%` }} /></div>
              <span className="proc-bar-label">{r.load}% capacity</span>
            </div>
            <div className="proc-stat"><span className="l">SLA</span>{r.sla}</div>
            <div className="proc-stat"><span className="l">Lead time</span>{r.lead}</div>
            <div className={`proc-status ${r.status}`}><span className="sdot" />{r.status === "healthy" ? "On track" : "Watch"}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ===== Skills =====
function Skills() {
  const skills = [
    { name: "Document OCR", icon: "ocr", agents: 412, util: "92%" },
    { name: "Text classification", icon: "classify", agents: 318, util: "84%" },
    { name: "Field validation", icon: "validate", agents: 296, util: "78%" },
    { name: "Decision routing", icon: "brain", agents: 184, util: "66%" },
  ];
  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">Skills coverage</h2>
        <a className="section-link" href="#">All 28 skills <SvgIcon style={{width:11,height:11}} name="arrow" /></a>
      </div>
      <div className="skills">
        {skills.map(s => (
          <div key={s.name} className="skill">
            <div className="skill-head">
              <div className="skill-icon"><SvgIcon name={s.icon} /></div>
              <div className="skill-name">{s.name}</div>
            </div>
            <div className="skill-stats">
              <div className="skill-num">{s.agents}</div>
              <div className="skill-l">agents</div>
            </div>
            <div className="skill-l" style={{ marginTop: -4 }}>{s.util} utilization</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ===== Exceptions =====
function Exceptions() {
  const items = [
    { title: "Invoice #INV-29481 — vendor mismatch on PO line 3", meta: "AP invoice triage · agent invoice-validator-04", time: "8 min ago" },
    { title: "KYC record requires manual document review", meta: "Customer KYC refresh · agent kyc-checker-02", time: "14 min ago" },
    { title: "Expense over policy threshold ($4,820)", meta: "Expense audit · agent expense-auditor-01", time: "22 min ago" },
    { title: "Ambiguous category — PO #PO-58812", meta: "PO categorization · agent po-classifier-12", time: "31 min ago" },
  ];
  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">Exceptions awaiting human review</h2>
        <a className="section-link" href="#">All 38 exceptions <SvgIcon style={{width:11,height:11}} name="arrow" /></a>
      </div>
      <div className="exceptions">
        {items.map((i, idx) => (
          <div key={idx} className="exc-row">
            <div className="exc-icon"><SvgIcon name="warn" /></div>
            <div className="exc-body">
              <span className="exc-title">{i.title}</span>
              <span className="exc-meta">{i.meta}</span>
            </div>
            <span className="exc-time">{i.time}</span>
            <button className="exc-action">Review</button>
          </div>
        ))}
      </div>
    </section>
  );
}

// ===== Integrations =====
function Integrations() {
  const intg = [
    { name: "SAP S/4HANA", status: "ok", note: "Connected · 1.2k req/min" },
    { name: "Salesforce", status: "ok", note: "Connected · 480 req/min" },
    { name: "Workday", status: "ok", note: "Connected · 96 req/min" },
    { name: "ServiceNow", status: "ok", note: "Connected · 312 req/min" },
    { name: "Outlook 365", status: "warn", note: "Token expires in 3 days" },
    { name: "Snowflake", status: "ok", note: "Connected · 24 req/min" },
  ];
  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">Integrations</h2>
        <a className="section-link" href="#">All 11 integrations <SvgIcon style={{width:11,height:11}} name="arrow" /></a>
      </div>
      <div className="integrations">
        {intg.map(i => (
          <div key={i.name} className="intg">
            <div className="intg-name">{i.name}</div>
            <div className={`intg-status ${i.status}`}><span className="idot" />{i.note}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ===== App =====
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "variant": "a"
}/*EDITMODE-END*/;

function App() {
  const [tweaks, setTweak] = (window.useTweaks || (() => [TWEAK_DEFAULTS, () => {}]))(TWEAK_DEFAULTS);
  const variant = tweaks.variant || "a";

  return (
    <div className="app" data-variant={variant}>
      <Sidebar />
      <main>
        <TopBar />
        {variant === "a" ? <CanvasA /> : <CanvasB />}
      </main>
      {window.TweaksPanel && (
        <window.TweaksPanel title="Tweaks">
          <window.TweakSection title="Layout">
            <window.TweakRadio
              label="Variant"
              value={variant}
              onChange={(v) => setTweak("variant", v)}
              options={[
                { value: "a", label: "A · Calm" },
                { value: "b", label: "B · Rhythm" },
              ]}
            />
          </window.TweakSection>
        </window.TweaksPanel>
      )}
    </div>
  );
}

function CanvasA() {
  return (
    <div className="canvas">
      <Greeting variant="a" />
      <Workforce />
      <ActivityNow />
      <Queue />
      <Processes />
      <Skills />
      <Exceptions />
      <Integrations />
    </div>
  );
}

// Variant B — same content, but rhythm: hero band, accent activity band, then standard
function CanvasB() {
  return (
    <>
      <div className="hero-band">
        <div className="hero-band-inner">
          <Greeting variant="b" />
        </div>
      </div>
      <div className="canvas">
        <div className="canvas-inner" style={{ paddingTop: 56, paddingBottom: 0 }}>
          <Workforce />
        </div>
      </div>
      <div className="activity-band">
        <div className="activity-band-inner">
          <ActivityNow />
        </div>
      </div>
      <div className="standard-band">
        <div className="standard-band-inner">
          <Queue />
        </div>
      </div>
      <div className="standard-band">
        <div className="standard-band-inner">
          <Processes />
        </div>
      </div>
      <div className="standard-band">
        <div className="standard-band-inner">
          <Skills />
        </div>
      </div>
      <div className="standard-band">
        <div className="standard-band-inner">
          <Exceptions />
        </div>
      </div>
      <div className="standard-band" style={{ borderBottom: "none" }}>
        <div className="standard-band-inner">
          <Integrations />
        </div>
      </div>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
