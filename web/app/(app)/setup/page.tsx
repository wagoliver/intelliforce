"use client";
/* eslint-disable */
// @ts-nocheck
import { useState, useEffect, useMemo, useRef } from "react";

import "./home-v2.css";
import "./department-setup.css";

// IntelliForce — Department setup page

const DATA = {
  "user": { "name": "Wagner", "role": "Operations builder", "org": "Arctica" },
  "people": [
    { "id": "p1", "name": "Daniela Reis", "role": "Head of Finance Ops", "email": "daniela.reis@arctica.com" },
    { "id": "p2", "name": "Marcos Vieira", "role": "Procurement Director", "email": "marcos.vieira@arctica.com" },
    { "id": "p3", "name": "Yara Mendes", "role": "Chief Risk Officer", "email": "yara.mendes@arctica.com" },
    { "id": "p4", "name": "Pedro Lima", "role": "Head of CX Operations", "email": "pedro.lima@arctica.com" },
    { "id": "p5", "name": "Camila Souza", "role": "HR Operations Manager", "email": "camila.souza@arctica.com" },
    { "id": "p6", "name": "Rodrigo Alves", "role": "Director of IT", "email": "rodrigo.alves@arctica.com" },
    { "id": "p7", "name": "Luiza Carvalho", "role": "Head of Legal", "email": "luiza.carvalho@arctica.com" },
    { "id": "p8", "name": "Bruno Tavares", "role": "Marketing Operations Lead", "email": "bruno.tavares@arctica.com" }
  ],
  "existing": {
    "finance": {
      "id": "finance", "name": "Finance", "ownerId": "p1",
      "objective": "Process 100% of AP invoices in under 5 minutes, end-to-end.",
      "squads": [
        { "id": "s1", "name": "Accounts Payable", "activities": [
          { "id": "a1", "name": "Invoice validator", "agents": 24 },
          { "id": "a2", "name": "PO matcher", "agents": 18 },
          { "id": "a3", "name": "Payment scheduler", "agents": 8 }
        ]},
        { "id": "s2", "name": "Tax & Compliance", "activities": [
          { "id": "a4", "name": "Tax reconciler", "agents": 12 },
          { "id": "a5", "name": "Audit sampler", "agents": 6 }
        ]},
        { "id": "s3", "name": "Expense audit", "activities": [
          { "id": "a6", "name": "Expense auditor", "agents": 14 }
        ]}
      ],
      "live": {
        "registered": 13208, "executed": 12402, "avgHandle": "2.1s",
        "errorPct": 0.6, "monthlyActual": 28400
      }
    }
  }
};

// Cost heuristic constants
const BASE_SEAT = 200;          // $ per agent / month (base seat license)
const TOKEN_RATE = 0.003;       // $ per 1K tokens
const TOKENS_PER_AGENT = 50000; // estimated monthly tokens per agent (heuristic)

// ===== Helpers =====
const uid = () => Math.random().toString(36).slice(2, 9);

function autoSkill(name) {
  if (!name) return "···";
  const clean = name.trim().toUpperCase().replace(/[^A-Z\s]/g, "");
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "···";
  if (words.length === 1) return words[0].slice(0, 3);
  if (words.length === 2) return (words[0][0] + words[1].slice(0, 2)).slice(0, 3);
  return words.slice(0, 3).map(w => w[0]).join("");
}

function totalAgents(squads) {
  return squads.reduce((s, sq) => s + sq.activities.reduce((a, ac) => a + (ac.agents || 0), 0), 0);
}
function totalActivities(squads) {
  return squads.reduce((s, sq) => s + sq.activities.length, 0);
}

// ===== Icons =====
const Ico = {
  search: <g stroke="currentColor" strokeWidth="1.4" fill="none"><circle cx="6.5" cy="6.5" r="3.5"/><path d="M9 9l3 3"/></g>,
  plus: <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none"/>,
  trash: <g stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round"><path d="M3 5h10M5 5V3.5h6V5M5.5 5l.5 8h4l.5-8"/></g>,
  drag: <g stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round"><circle cx="6" cy="4" r="0.5" fill="currentColor"/><circle cx="10" cy="4" r="0.5" fill="currentColor"/><circle cx="6" cy="8" r="0.5" fill="currentColor"/><circle cx="10" cy="8" r="0.5" fill="currentColor"/><circle cx="6" cy="12" r="0.5" fill="currentColor"/><circle cx="10" cy="12" r="0.5" fill="currentColor"/></g>,
  chev: <path d="M5 7l3 3 3-3" stroke="currentColor" strokeWidth="1.4" fill="none"/>,
  lock: <g stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"><rect x="3" y="7" width="10" height="7" rx="1"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/></g>,
  cap: <g stroke="currentColor" strokeWidth="1.4" fill="none"><path d="M8 2.5l5 2.5v3c0 3-2 5.5-5 6.5-3-1-5-3.5-5-6.5V5l5-2.5z"/></g>,
  arrow: <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.4" fill="none"/>,
  brand: <path d="M10 10 H54 V54 H10 Z M22 22 V42 H42 V22 Z" fill="currentColor" fillRule="evenodd"/>,
  back: <path d="M10 4l-4 4 4 4M6 8h8" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
};
const Svg = ({ name, viewBox = "0 0 16 16", ...rest }) => (
  <svg viewBox={viewBox} xmlns="http://www.w3.org/2000/svg" {...rest}>{Ico[name]}</svg>
);

// ===== Header =====
function SetupHeader({ mode, deptName, live }) {
  return (
    <header className="setup-head">
      <div className="setup-crumbs">
        <a href="Home v2.html"><Svg name="back" style={{ width: 11, height: 11, verticalAlign: "middle", marginRight: 4 }} />Workforce</a>
        <span className="sep">/</span>
        <span className="current">{mode === "edit" ? "Edit department" : "New department"}</span>
      </div>
      <div className="setup-head-row">
        <div>
          <h1 className="setup-title">
            {mode === "edit" ? deptName || "Edit department" : "Create a new department"}
          </h1>
          <p className="setup-sub">
            {mode === "edit"
              ? "Update structure, owner, and headcount. Live operations keep running while you edit."
              : "Define what this team does, who runs it, and the activities your digital workforce will execute."}
          </p>
        </div>
        <div className="setup-mode-pill">
          <span>{mode === "edit" ? "Edit mode" : "New department"}</span>
        </div>
      </div>
    </header>
  );
}

// ===== Owner combobox =====
function OwnerCombo({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setAdding(false); } }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const owner = value;
  const filtered = DATA.people.filter(p =>
    !query || p.name.toLowerCase().includes(query.toLowerCase()) || p.role.toLowerCase().includes(query.toLowerCase())
  );

  function pick(person) { onChange(person); setOpen(false); setQuery(""); setAdding(false); }
  function saveCustom() {
    if (!newName.trim()) return;
    pick({ id: "custom-" + uid(), name: newName.trim(), role: newRole.trim() || "—", email: newEmail.trim(), custom: true });
    setNewName(""); setNewRole(""); setNewEmail("");
  }

  return (
    <div className="combo" ref={ref}>
      <button className={`combo-trigger ${open ? "open" : ""}`} onClick={() => setOpen(o => !o)} type="button">
        {owner ? (
          <>
            <div className="combo-avatar">{owner.name[0]}</div>
            <div className="combo-text">
              <span className="combo-name">{owner.name}</span>
              <span className="combo-role">{owner.role}</span>
            </div>
          </>
        ) : (
          <>
            <div className="combo-avatar empty">?</div>
            <span className="placeholder">Select an owner…</span>
          </>
        )}
        <Svg name="chev" className="combo-chev" />
      </button>

      {open && (
        <div className="combo-menu">
          {!adding && (
            <>
              <div className="combo-search">
                <Svg name="search" className="ico" />
                <input
                  autoFocus value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search people…"
                />
              </div>
              {filtered.map(p => (
                <div key={p.id} className="combo-option" onClick={() => pick(p)}>
                  <div className="combo-avatar">{p.name[0]}</div>
                  <div className="combo-text">
                    <span className="combo-name">{p.name}</span>
                    <span className="combo-role">{p.role}</span>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div style={{ padding: "12px 10px", fontSize: 12.5, color: "var(--text-subtle)" }}>
                  No matches for "{query}"
                </div>
              )}
              <div className="combo-option-divider" />
              <div className="combo-add" onClick={() => setAdding(true)}>
                <Svg name="plus" className="ico" />
                Add new contact
              </div>
            </>
          )}

          {adding && (
            <div className="combo-add-form">
              <input className="input" placeholder="Full name" value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
              <input className="input" placeholder="Role / title" value={newRole} onChange={e => setNewRole(e.target.value)} />
              <input className="input" placeholder="Email (optional)" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
              <div className="combo-add-form-actions">
                <button className="btn-secondary" onClick={() => setAdding(false)} type="button">Cancel</button>
                <button className="btn-primary" onClick={saveCustom} type="button">Add contact</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ===== Stepper =====
function Stepper({ value, onChange, min = 0, max = 999 }) {
  return (
    <div className="stepper">
      <button type="button" onClick={() => onChange(Math.max(min, (value || 0) - 1))} disabled={(value || 0) <= min}>−</button>
      <input
        type="number"
        value={value}
        onChange={e => {
          const v = parseInt(e.target.value, 10);
          if (Number.isNaN(v)) onChange(0);
          else onChange(Math.min(max, Math.max(min, v)));
        }}
      />
      <button type="button" onClick={() => onChange(Math.min(max, (value || 0) + 1))} disabled={(value || 0) >= max}>+</button>
    </div>
  );
}

// ===== Activity row =====
function ActivityRow({ activity, onChange, onRemove }) {
  const skill = useMemo(() => autoSkill(activity.name), [activity.name]);
  return (
    <div className="activity">
      <span className="drag-handle" title="Drag to reorder"><Svg name="drag" /></span>
      <span className="activity-skill" title="Auto-generated from activity name">
        {skill}
        <span className="lock"><Svg name="lock" /></span>
      </span>
      <input
        className="activity-name-input"
        value={activity.name}
        onChange={e => onChange({ ...activity, name: e.target.value })}
        placeholder="Activity name (e.g. Invoice validator)"
      />
      <Stepper value={activity.agents} onChange={v => onChange({ ...activity, agents: v })} />
      <button className="icon-btn" title="Remove activity" onClick={onRemove} type="button">
        <Svg name="trash" className="ico" />
      </button>
    </div>
  );
}

// ===== Squad block =====
function SquadBlock({ squad, onChange, onRemove }) {
  function setName(name) { onChange({ ...squad, name }); }
  function setActivity(idx, act) {
    const next = [...squad.activities];
    next[idx] = act;
    onChange({ ...squad, activities: next });
  }
  function removeActivity(idx) {
    const next = squad.activities.filter((_, i) => i !== idx);
    onChange({ ...squad, activities: next });
  }
  function addActivity() {
    onChange({ ...squad, activities: [...squad.activities, { id: uid(), name: "", agents: 1 }] });
  }
  return (
    <div className="squad">
      <div className="squad-head">
        <span className="drag-handle" title="Drag to reorder"><Svg name="drag" /></span>
        <input
          className="squad-name-input"
          value={squad.name}
          onChange={e => setName(e.target.value)}
          placeholder="Squad / function name (e.g. Accounts Payable)"
        />
        <div className="squad-actions">
          <button className="icon-btn" onClick={onRemove} type="button" title="Remove squad">
            <Svg name="trash" className="ico" />
          </button>
        </div>
      </div>
      <div className="activities">
        {squad.activities.map((a, i) => (
          <ActivityRow
            key={a.id}
            activity={a}
            onChange={act => setActivity(i, act)}
            onRemove={() => removeActivity(i)}
          />
        ))}
        <button className="add-btn" onClick={addActivity} type="button">
          <Svg name="plus" className="ico" />
          Add activity
        </button>
      </div>
    </div>
  );
}

// ===== Sidebar nav icons (matching home-v2) =====
const NavIco = {
  home: <path d="M3 9.5l5-5 5 5V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round"/>,
  agents: <g stroke="currentColor" strokeWidth="1.4" fill="none"><circle cx="8" cy="6" r="2.5"/><path d="M3 13.5c0-2.2 2.2-4 5-4s5 1.8 5 4"/></g>,
  proc: <g stroke="currentColor" strokeWidth="1.4" fill="none"><rect x="2.5" y="3" width="4" height="4" rx="0.5"/><rect x="9.5" y="3" width="4" height="4" rx="0.5"/><rect x="6" y="9" width="4" height="4" rx="0.5"/><path d="M4.5 7v1M11.5 7v1M6 11h-1.5v-3M10 11h1.5v-3"/></g>,
  queue: <g stroke="currentColor" strokeWidth="1.4" fill="none"><rect x="2.5" y="3" width="11" height="2.5" rx="0.5"/><rect x="2.5" y="6.75" width="11" height="2.5" rx="0.5"/><rect x="2.5" y="10.5" width="11" height="2.5" rx="0.5"/></g>,
  org: <g stroke="currentColor" strokeWidth="1.4" fill="none"><rect x="6" y="2.5" width="4" height="3" rx="0.5"/><rect x="2" y="10.5" width="4" height="3" rx="0.5"/><rect x="10" y="10.5" width="4" height="3" rx="0.5"/><path d="M8 5.5v2.5M4 10.5V8h8v2.5"/></g>,
  intg: <g stroke="currentColor" strokeWidth="1.4" fill="none"><path d="M5 3v3h-2v4h2v3M11 3v3h2v4h-2v3"/></g>,
  people: <g stroke="currentColor" strokeWidth="1.4" fill="none"><circle cx="6" cy="6" r="2"/><circle cx="11" cy="6" r="1.5"/><path d="M2.5 13c0-1.8 1.5-3.2 3.5-3.2s3.5 1.4 3.5 3.2M9.5 13c0-1.4 1-2.5 2-2.5s2 1.1 2 2.5"/></g>,
  insights: <g stroke="currentColor" strokeWidth="1.4" fill="none"><path d="M3 13V8M7 13V4M11 13V10"/></g>,
  set: <g stroke="currentColor" strokeWidth="1.4" fill="none"><circle cx="8" cy="8" r="2"/><path d="M8 1.5v1.5M8 13v1.5M14.5 8H13M3 8H1.5M12.5 3.5l-1 1M4.5 11.5l-1 1M12.5 12.5l-1-1M4.5 4.5l-1-1"/></g>,
};
const NavSvg = ({ name }) => (
  <svg className="ico" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">{NavIco[name]}</svg>
);

function Sidebar() {
  const items = [
    { name: "Home", icon: "home" },
    { name: "Organization", icon: "org", active: true },
    { name: "Agents", icon: "agents" },
    { name: "Processes", icon: "proc" },
    { name: "Queue", icon: "queue" },
  ];
  const config = [
    { name: "Integrations", icon: "intg" },
    { name: "People", icon: "people" },
    { name: "Insights", icon: "insights" },
    { name: "Settings", icon: "set" },
  ];
  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <div className="sb-brand-mark">
          <svg viewBox="0 0 64 64"><path d="M10 10 H54 V54 H10 Z M22 22 V42 H42 V22 Z" fill="currentColor" fillRule="evenodd" /></svg>
        </div>
        <div className="sb-brand-name">IntelliForce</div>
      </div>
      <div className="sb-org">{DATA.user.org}</div>
      <nav className="sb-nav">
        {items.map(i => (
          <a key={i.name} href={i.name === "Home" ? "Home v2.html" : "#"} className={`sb-item ${i.active ? "active" : ""}`}>
            <NavSvg name={i.icon} />
            <span>{i.name}</span>
          </a>
        ))}
        <div className="sb-section-label">Configure</div>
        {config.map(i => (
          <a key={i.name} href="#" className="sb-item">
            <NavSvg name={i.icon} />
            <span>{i.name}</span>
          </a>
        ))}
      </nav>
    </aside>
  );
}

// ===== App =====
function App() {
  // Detect mode from URL
  const params = new URLSearchParams(window.location.search);
  const editId = params.get("id");
  const existing = editId && DATA.existing[editId] ? DATA.existing[editId] : null;
  const mode = existing ? "edit" : "create";

  // State
  const [name, setName] = useState(existing?.name || "");
  const [owner, setOwner] = useState(existing ? DATA.people.find(p => p.id === existing.ownerId) : null);
  const [objective, setObjective] = useState(existing?.objective || "");
  const [squads, setSquads] = useState(existing?.squads || [
    { id: uid(), name: "", activities: [{ id: uid(), name: "", agents: 1 }] }
  ]);
  const [activate, setActivate] = useState(true);

  // Cost calc
  const agents = totalAgents(squads);
  const activities = totalActivities(squads);
  const baseCost = agents * BASE_SEAT;
  const estTokens = agents * TOKENS_PER_AGENT;
  const tokenCost = (estTokens / 1000) * TOKEN_RATE;
  const totalCost = baseCost + tokenCost;

  // Squad ops
  function setSquad(idx, sq) {
    const next = [...squads]; next[idx] = sq; setSquads(next);
  }
  function removeSquad(idx) {
    setSquads(squads.filter((_, i) => i !== idx));
  }
  function addSquad() {
    setSquads([...squads, { id: uid(), name: "", activities: [{ id: uid(), name: "", agents: 1 }] }]);
  }

  const live = existing?.live;
  const canSubmit = name.trim() && owner && objective.trim() && squads.length > 0 && squads.every(sq => sq.name.trim() && sq.activities.every(a => a.name.trim()));

  return (
    <div className="app">
      <Sidebar />
      <main>
        <SetupHeader mode={mode} deptName={name} live={live} />
        <div className="setup-app">
          <div className="setup-form">
            {/* SECTION 1: Identity */}
            <section className="setup-section">
              <div className="setup-section-head">
                <span className="setup-section-num">01</span>
                <div>
                  <h2 className="setup-section-title">Identity</h2>
                  <p className="setup-section-desc">Name the department, assign an accountable human owner, and write the objective in one sentence.</p>
                </div>
              </div>
              <div className="field">
                <label className="field-label">Department name</label>
                <input
                  className="input"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Finance, Procurement, Customer Support"
                />
              </div>
              <div className="field">
                <label className="field-label">Owner</label>
                <OwnerCombo value={owner} onChange={setOwner} />
                <span className="field-hint">The human accountable for this department's outcomes. Pick from your org or add a new contact.</span>
              </div>
              <div className="field">
                <label className="field-label">Objective</label>
                <textarea
                  className="textarea"
                  value={objective}
                  onChange={e => setObjective(e.target.value)}
                  placeholder="e.g. Process 100% of AP invoices in under 5 minutes, end-to-end."
                  maxLength={180}
                />
                <span className="field-hint">{objective.length} / 180 — what does this department exist to deliver?</span>
              </div>
            </section>

            {/* SECTION 2: Structure */}
            <section className="setup-section">
              <div className="setup-section-head">
                <span className="setup-section-num">02</span>
                <div>
                  <h2 className="setup-section-title">Structure</h2>
                  <p className="setup-section-desc">Group activities into squads. Each activity is an action your agents will execute repeatedly. Codes are auto-generated from the activity name.</p>
                </div>
              </div>
              <div className="squads">
                {squads.map((sq, i) => (
                  <SquadBlock key={sq.id} squad={sq} onChange={s => setSquad(i, s)} onRemove={() => removeSquad(i)} />
                ))}
                <button className="add-squad-btn" onClick={addSquad} type="button">
                  <Svg name="plus" className="ico" />
                  Add squad
                </button>
              </div>
            </section>

            {/* SECTION 3: Capabilities placeholder */}
            <section className="setup-section">
              <div className="setup-section-head">
                <span className="setup-section-num">03</span>
                <div>
                  <h2 className="setup-section-title">Capabilities</h2>
                  <p className="setup-section-desc">Each activity needs skills and tools to be executed by an agent — system access, parsers, APIs, runbooks.</p>
                </div>
              </div>
              <div className="cap-placeholder">
                <div className="cap-placeholder-icon"><Svg name="cap" className="ico" /></div>
                <div className="cap-placeholder-text">
                  <strong>Configure capabilities after creation.</strong> Once the department exists, open each activity to attach the skills and tools its agents need to operate.
                </div>
                <a className="btn-secondary" href="Capabilities.html?activity=a1">
                  Set up capabilities
                  <Svg name="arrow" className="ico" style={{ width: 12, height: 12 }} />
                </a>
              </div>
            </section>

            {/* SECTION 4: Cost & activation */}
            <section className="setup-section">
              <div className="setup-section-head">
                <span className="setup-section-num">04</span>
                <div>
                  <h2 className="setup-section-title">Cost & activation</h2>
                  <p className="setup-section-desc">Monthly cost is calculated from agent seats plus estimated token usage. The estimate updates live as you adjust headcount.</p>
                </div>
              </div>

              <div className="cost-card">
                <div className="cost-formula">
                  <div className="cost-formula-row">
                    <span className="label">Formula</span>
                    <span className="value">(agents × base seat) + (estimated tokens × rate)</span>
                  </div>
                  <div className="cost-formula-row">
                    <span className="label">Substitute</span>
                    <span className="value">
                      ({agents} × ${BASE_SEAT}) + ({(estTokens/1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}K × ${TOKEN_RATE})
                    </span>
                  </div>
                  <div className="cost-formula-row">
                    <span className="label">Compute</span>
                    <span className="value">
                      <strong>${baseCost.toLocaleString()}</strong> <span className="op">+</span> <strong>${tokenCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
                    </span>
                  </div>
                  <div className="cost-formula-row total">
                    <span className="label">Total</span>
                    <span className="value">${totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })} / month</span>
                  </div>
                </div>

                <div className="cost-breakdown">
                  <div className="cost-breakdown-item">
                    <span className="cost-breakdown-l">Base seats</span>
                    <span className="cost-breakdown-v">${BASE_SEAT}/agent</span>
                    <span className="cost-breakdown-s">flat license per active digital employee</span>
                  </div>
                  <div className="cost-breakdown-item">
                    <span className="cost-breakdown-l">Token estimate</span>
                    <span className="cost-breakdown-v">{(TOKENS_PER_AGENT/1000)}K /agent</span>
                    <span className="cost-breakdown-s">heuristic — refines as activity history accumulates</span>
                  </div>
                </div>

                <div className="activate-row">
                  <div className={`toggle ${activate ? "on" : ""}`} onClick={() => setActivate(a => !a)} role="switch" aria-checked={activate} />
                  <div className="toggle-label">
                    Activate immediately on create
                    <span className="toggle-sub">Agents start working as soon as capabilities are configured. Turn off to save as draft.</span>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* RIGHT: Live summary */}
          <aside className="setup-summary">
            <div className="summary-eyebrow">Live preview</div>

            <div className="summary-card">
              <div className={`summary-name ${!name ? "empty" : ""}`}>
                {name || "Untitled department"}
              </div>

              <div className="summary-meta">
                <div className="summary-meta-row">
                  <span className="summary-meta-l">Owner</span>
                  <span className={`summary-meta-v ${!owner ? "empty" : ""}`}>
                    {owner ? <><strong>{owner.name}</strong> · {owner.role}</> : "Unassigned"}
                  </span>
                </div>
                <div className="summary-meta-row">
                  <span className="summary-meta-l">Objective</span>
                  <span className={`summary-meta-v ${!objective ? "empty" : ""}`}>
                    {objective || "No objective yet"}
                  </span>
                </div>
              </div>

              <div className="summary-tiles">
                <div className="summary-tile">
                  <span className="summary-tile-l">Squads</span>
                  <span className="summary-tile-v">{squads.length}</span>
                </div>
                <div className="summary-tile">
                  <span className="summary-tile-l">Activities</span>
                  <span className="summary-tile-v">{activities}</span>
                </div>
                <div className="summary-tile">
                  <span className="summary-tile-l">Agents</span>
                  <span className="summary-tile-v">{agents}</span>
                </div>
              </div>

              <div className="summary-cost">
                <span className="summary-cost-l">Estimated monthly cost</span>
                <span className="summary-cost-v">${totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                <span className="summary-cost-s">updates live as you edit headcount</span>
              </div>
            </div>

            {/* Live operations card (edit mode only) */}
            {mode === "edit" && live && (
              <div className="live-card">
                <div className="live-head">
                  <span className="live-title">Live operations</span>
                  <span className="live-pill"><span className="dot" />Running</span>
                </div>
                <div className="live-grid">
                  <div>
                    <div className="live-item-l">Registered today</div>
                    <div className="live-item-v">{live.registered.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="live-item-l">Executed (12h)</div>
                    <div className="live-item-v">{live.executed.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="live-item-l">Avg. handle</div>
                    <div className="live-item-v">{live.avgHandle}</div>
                  </div>
                  <div>
                    <div className="live-item-l">Error rate</div>
                    <div className="live-item-v">{live.errorPct}%</div>
                  </div>
                </div>
                <div style={{ paddingTop: 10, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span className="live-item-l">Actual cost (this month)</span>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 500, color: "var(--text)" }}>
                    ${live.monthlyActual.toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {/* Pending pill (create mode) */}
            {mode === "create" && (
              <div className="pending-pill" style={{ alignSelf: "flex-start" }}>
                <span className="dot" />
                Operational metrics appear after activation
              </div>
            )}
          </aside>
        </div>

        <div className="setup-actions">
          <a className="btn-secondary" href="Home v2.html">Cancel</a>
          <button className="btn-secondary" type="button">Save as draft</button>
          <button className="btn-primary" type="button" disabled={!canSubmit}>
            {mode === "edit" ? "Save changes" : "Create department"}
          </button>
        </div>
      </main>
    </div>
  );
}

export default App;
