"use client";
/* eslint-disable */
// @ts-nocheck
import { useState, useEffect, useMemo, useRef } from "react";

import "../dashboard/home-v2.css";
import "./department-setup.css";
import "./capabilities.css";

// IntelliForce — Capabilities IDE

const D = {
  "user": { "name": "Wagner", "role": "Operations builder", "org": "Arctica" },
  "activity": {
    "id": "a1", "name": "Invoice validator", "skill": "VAL",
    "department": "Finance", "squad": "Accounts Payable", "agents": 24,
    "siblings": [
      { "id": "a1", "name": "Invoice validator", "skill": "VAL", "status": "partial" },
      { "id": "a2", "name": "PO matcher", "skill": "MAT", "status": "configured" },
      { "id": "a3", "name": "Payment scheduler", "skill": "SCH", "status": "empty" }
    ]
  },
  "tools": [
    { "id": "t1", "name": "SQL query", "type": "Database", "desc": "Run parameterized SQL against approved warehouses.", "enabled": true },
    { "id": "t2", "name": "Web fetch", "type": "Network", "desc": "Fetch a URL and return parsed body. Allow-list controlled.", "enabled": false }
  ],
  "templates": [
    { "id": "tpl1", "name": "Generic invoice validator", "desc": "Validates header fields, totals, and PO references against a finance system.", "category": "Finance", "tools": ["SQL query"] },
    { "id": "tpl2", "name": "KYC document checker", "desc": "Verifies identity documents against issuer registries and detects tampering.", "category": "Risk", "tools": ["Web fetch"] },
    { "id": "tpl3", "name": "Ticket triage", "desc": "Classifies tier-1 support tickets by intent and urgency.", "category": "Support", "tools": [] },
    { "id": "tpl4", "name": "PO matcher", "desc": "Three-way match of PO, receipt, and invoice with tolerance bands.", "category": "Finance", "tools": ["SQL query"] },
    { "id": "tpl5", "name": "Anomaly flagger", "desc": "Surfaces transactions outside historical norms using simple z-score logic.", "category": "Risk", "tools": ["SQL query"] },
    { "id": "tpl6", "name": "Email auto-responder", "desc": "Generates first-touch responses based on a knowledge base.", "category": "Support", "tools": ["Web fetch"] }
  ]
};

// ===== Icons =====
const I = {
  back: <path d="M10 4l-4 4 4 4M6 8h8" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
  plus: <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none"/>,
  trash: <g stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round"><path d="M3 5h10M5 5V3.5h6V5M5.5 5l.5 8h4l.5-8"/></g>,
  close: <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none"/>,
  play: <path d="M5 3l8 5-8 5z" fill="currentColor"/>,
  copy: <g stroke="currentColor" strokeWidth="1.4" fill="none"><rect x="5" y="5" width="8" height="8" rx="1"/><path d="M11 5V3.5a.5.5 0 0 0-.5-.5h-7a.5.5 0 0 0-.5.5v7a.5.5 0 0 0 .5.5H5"/></g>,
  doc: <g stroke="currentColor" strokeWidth="1.4" fill="none"><path d="M4 2.5h6l3 3V13a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5V3a.5.5 0 0 1 .5-.5z M10 2.5V5.5h3"/></g>,
  upload: <g stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round"><path d="M8 11V3M5 6l3-3 3 3M3 13h10"/></g>,
  sql: <g stroke="currentColor" strokeWidth="1.4" fill="none"><ellipse cx="8" cy="4" rx="5" ry="1.5"/><path d="M3 4v8c0 .8 2.2 1.5 5 1.5s5-.7 5-1.5V4 M3 8c0 .8 2.2 1.5 5 1.5s5-.7 5-1.5"/></g>,
  web: <g stroke="currentColor" strokeWidth="1.4" fill="none"><circle cx="8" cy="8" r="5.5"/><path d="M2.5 8h11M8 2.5c2 1.8 2 9.2 0 11M8 2.5c-2 1.8-2 9.2 0 11"/></g>,
  cap: <g stroke="currentColor" strokeWidth="1.4" fill="none"><path d="M8 2.5l5 2.5v3c0 3-2 5.5-5 6.5-3-1-5-3.5-5-6.5V5l5-2.5z"/></g>,
  webhook: <g stroke="currentColor" strokeWidth="1.4" fill="none"><circle cx="5" cy="11" r="2"/><circle cx="11" cy="5" r="2"/><circle cx="11" cy="11" r="2"/><path d="M6.5 9.5l3-3M9 11h0"/></g>,
  queue: <g stroke="currentColor" strokeWidth="1.4" fill="none"><rect x="2.5" y="3" width="11" height="2.5" rx="0.5"/><rect x="2.5" y="6.75" width="11" height="2.5" rx="0.5"/><rect x="2.5" y="10.5" width="11" height="2.5" rx="0.5"/></g>,
  cron: <g stroke="currentColor" strokeWidth="1.4" fill="none"><circle cx="8" cy="8" r="5.5"/><path d="M8 5v3l2 2"/></g>,
  event: <g stroke="currentColor" strokeWidth="1.4" fill="none"><path d="M9 2.5L4 9h4l-1 4.5L12 7H8z"/></g>,
  expand: <path d="M11 4l-3 4 3 4M5 4l-3 4 3 4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
  collapse: <path d="M5 4l3 4-3 4M11 4l3 4-3 4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
  chev: <path d="M5 7l3 3 3-3" stroke="currentColor" strokeWidth="1.4" fill="none"/>,
};
const Svg = ({ name, ...rest }) => (
  <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" {...rest}>{I[name]}</svg>
);

// ===== App =====
function App() {
  const [tab, setTab] = useState("skill");
  const [benchOpen, setBenchOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newToolOpen, setNewToolOpen] = useState(false);

  // Skill state
  const [role, setRole] = useState("You are an Invoice validator agent for the Accounts Payable squad. You validate inbound invoices for completeness, integrity, and policy compliance before passing them to PO matching.");
  const [goal, setGoal] = useState("For every invoice, verify that all mandatory fields are present, totals match line items, and the supplier is on the approved vendor list. Output a structured validation result.");
  const [constraints, setConstraints] = useState("Never auto-approve invoices above $10,000.\nNever modify invoice content — only validate.\nIf any required field is missing, return needs_review with a clear reason.");
  const [outputSchema, setOutputSchema] = useState(`{
  "invoice_id": "string",
  "valid": "boolean",
  "issues": ["string"],
  "next_step": "approve | needs_review | reject"
}`);
  const [examples, setExamples] = useState([
    { id: "ex1", input: "INV-2049, supplier ACME Corp, total $4,820, 3 line items matching PO-7711", output: "{ valid: true, issues: [], next_step: \"approve\" }" }
  ]);

  // Tools state
  const [tools, setTools] = useState(D.tools);
  const enabledTools = tools.filter(t => t.enabled);

  // Knowledge
  const [knowledge, setKnowledge] = useState([
    { id: "k1", name: "AP Policy v3.2.pdf", size: "412 KB", tokens: "8.2K" },
    { id: "k2", name: "Approved supplier list.csv", size: "84 KB", tokens: "2.1K" }
  ]);

  // Guardrails
  const [guardrails, setGuardrails] = useState([
    { id: "g1", text: "If invoice amount > $10,000 → require human approval before downstream routing." },
    { id: "g2", text: "If supplier is not in the approved vendor list → block and notify Procurement." }
  ]);

  // Trigger
  const [trigger, setTrigger] = useState("queue");

  // Bench
  const [benchInput, setBenchInput] = useState(`{
  "invoice_id": "INV-3122",
  "supplier": "Acme Corp",
  "total": 4820.00,
  "line_items": 3,
  "po_reference": "PO-7711"
}`);
  const [benchResult, setBenchResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState([
    { id: "h1", time: "2m ago", ok: true, summary: "INV-3122 → approve" },
    { id: "h2", time: "8m ago", ok: true, summary: "INV-3120 → needs_review" },
    { id: "h3", time: "21m ago", ok: false, summary: "Schema error" }
  ]);

  // Configured count for status
  const filled = [
    role.trim() && goal.trim(),       // skill
    enabledTools.length > 0,          // tools
    knowledge.length > 0,             // knowledge
    guardrails.length > 0,            // guardrails
    !!trigger                         // triggers
  ].filter(Boolean).length;

  function applyTemplate(tpl) {
    setRole(`You are a ${tpl.name.toLowerCase()} agent. ${tpl.desc}`);
    setGoal(tpl.desc);
    // Enable matching tools
    setTools(tools.map(t => ({ ...t, enabled: tpl.tools.includes(t.name) })));
    setDrawerOpen(false);
  }

  function runBench() {
    setRunning(true);
    setBenchResult(null);
    setTimeout(() => {
      setBenchResult({
        trace: [
          { tag: "skill", text: "Loaded role + goal · 184 tokens" },
          { tag: "tool", text: "SQL query → SELECT * FROM approved_suppliers WHERE name='Acme Corp' → 1 match" },
          { tag: "knowledge", text: "Retrieved 2 chunks from AP Policy v3.2.pdf" },
          { tag: "guardrail", text: "Passed: amount $4,820 ≤ $10,000 threshold" }
        ],
        final: `{\n  "invoice_id": "INV-3122",\n  "valid": true,\n  "issues": [],\n  "next_step": "approve"\n}`
      });
      setRunning(false);
      setHistory([{ id: "h-" + Date.now(), time: "just now", ok: true, summary: "INV-3122 → approve" }, ...history.slice(0, 4)]);
    }, 900);
  }

  return (
    <>
      <div className={`cap-app ${benchOpen ? "" : "bench-collapsed"}`}>

          {/* LEFT: Navigator */}
          <aside className="cap-nav">
            <a className="cap-nav-back" href="/setup">
              <Svg name="back" className="ico" />
              Back to {D.activity.department}
            </a>

            <div className="cap-nav-crumb">
              {D.activity.department}<span className="sep">›</span>
              {D.activity.squad}<span className="sep">›</span>
              <span className="current">{D.activity.name}</span>
            </div>

            <div className="cap-nav-status">
              <span className="cap-nav-status-l">Status</span>
              <span className="cap-nav-status-v">{filled} of 5 configured</span>
              <div className="cap-nav-progress">
                {[0,1,2,3,4].map(i => <span key={i} className={`seg ${i < filled ? "done" : ""}`} />)}
              </div>
            </div>

            <div>
              <div className="cap-nav-section-l">Squad activities</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 6 }}>
                {D.activity.siblings.map(s => (
                  <a key={s.id} className={`cap-sibling ${s.id === D.activity.id ? "active" : ""}`} href="#">
                    <span className="cap-sibling-skill">{s.skill}</span>
                    <span className={`cap-sibling-name ${s.id === D.activity.id ? "" : "muted"}`}>{s.name}</span>
                    <span className={`cap-sibling-status ${s.status}`} title={s.status} />
                  </a>
                ))}
              </div>
            </div>

            <button className="cap-templates-btn" onClick={() => setDrawerOpen(true)}>
              <Svg name="cap" className="ico" />
              Browse capability templates
            </button>
          </aside>

          {/* CENTER: Editor */}
          <div className="cap-editor">
            <div className="cap-tabs">
              <div className={`cap-tab ${tab === "skill" ? "active" : ""}`} onClick={() => setTab("skill")}>Skill</div>
              <div className={`cap-tab ${tab === "tools" ? "active" : ""}`} onClick={() => setTab("tools")}>
                Tools <span className="count">{enabledTools.length}/{tools.length}</span>
              </div>
              <div className={`cap-tab ${tab === "knowledge" ? "active" : ""}`} onClick={() => setTab("knowledge")}>
                Knowledge <span className="count">{knowledge.length}</span>
              </div>
              <div className={`cap-tab ${tab === "guardrails" ? "active" : ""}`} onClick={() => setTab("guardrails")}>
                Guardrails <span className="count">{guardrails.length}</span>
              </div>
              <div className={`cap-tab ${tab === "triggers" ? "active" : ""}`} onClick={() => setTab("triggers")}>Triggers</div>
            </div>

            {/* SKILL */}
            {tab === "skill" && (
              <div className="cap-pane">
                <div className="cap-pane-head">
                  <h2 className="cap-pane-title">Skill</h2>
                  <p className="cap-pane-desc">Describe how this agent thinks and what it returns. Each field is sent to the model as part of the system prompt at runtime.</p>
                </div>

                <div className="skill-block">
                  <div className="skill-label-row">
                    <span className="skill-label">Role</span>
                    <span className="skill-counter">{role.length} chars</span>
                  </div>
                  <textarea className="code-area" value={role} onChange={e => setRole(e.target.value)} style={{ minHeight: 60 }} />
                </div>

                <div className="skill-block">
                  <div className="skill-label-row">
                    <span className="skill-label">Goal</span>
                    <span className="skill-counter">{goal.length} chars</span>
                  </div>
                  <textarea className="code-area" value={goal} onChange={e => setGoal(e.target.value)} style={{ minHeight: 80 }} />
                </div>

                <div className="skill-block">
                  <div className="skill-label-row">
                    <span className="skill-label">Constraints</span>
                    <span className="skill-counter">{constraints.length} chars</span>
                  </div>
                  <textarea className="code-area" value={constraints} onChange={e => setConstraints(e.target.value)} style={{ minHeight: 100 }} />
                </div>

                <div className="skill-block">
                  <div className="skill-label-row">
                    <span className="skill-label">Output format · JSON schema</span>
                    <span className="skill-counter">structured</span>
                  </div>
                  <textarea className="code-area" value={outputSchema} onChange={e => setOutputSchema(e.target.value)} style={{ minHeight: 130 }} />
                </div>

                <div className="skill-block">
                  <div className="skill-label-row">
                    <span className="skill-label">Few-shot examples</span>
                    <span className="skill-counter">{examples.length} examples</span>
                  </div>
                  <div className="fewshot-list">
                    {examples.map((ex, i) => (
                      <div key={ex.id} className="fewshot">
                        <div className="fewshot-row">
                          <span className="fewshot-row-l">Input</span>
                          <textarea value={ex.input} onChange={e => {
                            const next = [...examples]; next[i] = { ...ex, input: e.target.value }; setExamples(next);
                          }} />
                        </div>
                        <div className="fewshot-row">
                          <span className="fewshot-row-l">Expected output</span>
                          <textarea value={ex.output} onChange={e => {
                            const next = [...examples]; next[i] = { ...ex, output: e.target.value }; setExamples(next);
                          }} />
                        </div>
                        <div className="fewshot-actions">
                          <button className="icon-btn" onClick={() => setExamples(examples.filter(x => x.id !== ex.id))}>
                            <Svg name="trash" className="ico" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <button className="add-btn" onClick={() => setExamples([...examples, { id: "ex" + Date.now(), input: "", output: "" }])}>
                      <Svg name="plus" className="ico" />
                      Add example
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TOOLS */}
            {tab === "tools" && (
              <div className="cap-pane">
                <div className="cap-pane-head">
                  <h2 className="cap-pane-title">Tools</h2>
                  <p className="cap-pane-desc">Capabilities the agent can invoke at runtime. Enable existing tools or create a new one for this organization.</p>
                </div>
                <div className="tools-grid">
                  {tools.map(t => (
                    <div key={t.id} className={`tool-card ${t.enabled ? "enabled" : ""}`}>
                      <div className="tool-icon">
                        <Svg name={t.id === "t1" ? "sql" : "web"} className="ico" />
                      </div>
                      <div className="tool-meta">
                        <div className="tool-head">
                          <span className="tool-name">{t.name}</span>
                          <span className="tool-type">{t.type}</span>
                        </div>
                        <div className="tool-desc">{t.desc}</div>
                      </div>
                      <div className={`toggle ${t.enabled ? "on" : ""}`}
                        onClick={() => setTools(tools.map(x => x.id === t.id ? { ...x, enabled: !x.enabled } : x))}
                      />
                    </div>
                  ))}
                  <button className="create-tool-card" onClick={() => setNewToolOpen(true)}>
                    <Svg name="plus" className="ico" />
                    Create new tool
                  </button>
                </div>
              </div>
            )}

            {/* KNOWLEDGE */}
            {tab === "knowledge" && (
              <div className="cap-pane">
                <div className="cap-pane-head">
                  <h2 className="cap-pane-title">Knowledge</h2>
                  <p className="cap-pane-desc">Reference documents the agent retrieves from. Files are chunked, embedded, and indexed automatically.</p>
                </div>
                <div className="knowledge-drop">
                  <Svg name="upload" className="ico" />
                  <div><strong>Drop files here</strong> or pick from your library</div>
                  <button className="upload-cta">
                    <Svg name="upload" className="ico" style={{ width: 12, height: 12 }} />
                    Upload files
                  </button>
                </div>
                <div className="knowledge-list">
                  {knowledge.map(k => (
                    <div key={k.id} className="knowledge-item">
                      <div className="knowledge-icon"><Svg name="doc" className="ico" /></div>
                      <div className="knowledge-meta">
                        <span className="knowledge-name">{k.name}</span>
                        <span className="knowledge-sub">{k.size}</span>
                      </div>
                      <span className="knowledge-tokens">{k.tokens} tokens</span>
                      <button className="icon-btn" onClick={() => setKnowledge(knowledge.filter(x => x.id !== k.id))}>
                        <Svg name="trash" className="ico" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* GUARDRAILS */}
            {tab === "guardrails" && (
              <div className="cap-pane">
                <div className="cap-pane-head">
                  <h2 className="cap-pane-title">Guardrails</h2>
                  <p className="cap-pane-desc">Plain-language rules enforced at runtime. The agent will refuse, escalate, or modify behavior when a rule matches.</p>
                </div>
                <div className="guardrail-list">
                  {guardrails.map((g, i) => (
                    <div key={g.id} className="guardrail">
                      <span className="guardrail-num">R{i + 1}</span>
                      <input className="guardrail-text" value={g.text} onChange={e => {
                        const next = [...guardrails]; next[i] = { ...g, text: e.target.value }; setGuardrails(next);
                      }} />
                      <button className="icon-btn" onClick={() => setGuardrails(guardrails.filter(x => x.id !== g.id))}>
                        <Svg name="trash" className="ico" />
                      </button>
                    </div>
                  ))}
                  <button className="add-btn" onClick={() => setGuardrails([...guardrails, { id: "g" + Date.now(), text: "" }])}>
                    <Svg name="plus" className="ico" />
                    Add rule
                  </button>
                </div>
              </div>
            )}

            {/* TRIGGERS */}
            {tab === "triggers" && (
              <div className="cap-pane">
                <div className="cap-pane-head">
                  <h2 className="cap-pane-title">Triggers</h2>
                  <p className="cap-pane-desc">How this activity is invoked. Choose one — you can combine triggers later via routing rules.</p>
                </div>
                <div className="trigger-grid">
                  {[
                    { id: "webhook", name: "Webhook", icon: "webhook", desc: "External systems POST to a URL we generate." },
                    { id: "queue", name: "Queue", icon: "queue", desc: "Pull from an internal task queue (default for Finance)." },
                    { id: "schedule", name: "Schedule", icon: "cron", desc: "Run on a cron schedule, e.g. every 15 minutes." },
                    { id: "event", name: "Event", icon: "event", desc: "React to events emitted by other activities." }
                  ].map(t => (
                    <div key={t.id} className={`trigger-card ${trigger === t.id ? "active" : ""}`} onClick={() => setTrigger(t.id)}>
                      <div className="trigger-icon"><Svg name={t.icon} className="ico" /></div>
                      <div>
                        <div className="trigger-name">{t.name}</div>
                        <div className="trigger-desc">{t.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {trigger === "webhook" && (
                  <div className="trigger-config">
                    <div className="trigger-config-l">Generated webhook URL</div>
                    <div className="webhook-url">
                      <span className="webhook-url-text">https://api.intelliforce.io/v1/webhooks/finance/invoice-validator/whk_8a9f2e</span>
                      <button className="webhook-copy"><Svg name="copy" className="ico" style={{ width: 10, height: 10, verticalAlign: "middle", marginRight: 4 }} />Copy</button>
                    </div>
                  </div>
                )}
                {trigger === "queue" && (
                  <div className="trigger-config">
                    <div className="trigger-config-l">Queue source</div>
                    <select className="input" defaultValue="ap_inbound">
                      <option value="ap_inbound">ap_inbound (Accounts Payable)</option>
                      <option value="finance_general">finance_general</option>
                    </select>
                  </div>
                )}
                {trigger === "schedule" && (
                  <div className="trigger-config">
                    <div className="trigger-config-l">Cron expression</div>
                    <input className="input" defaultValue="*/15 * * * *" />
                    <span style={{ fontSize: 11, color: "var(--text-subtle)", marginTop: 6, display: "block" }}>Every 15 minutes</span>
                  </div>
                )}
                {trigger === "event" && (
                  <div className="trigger-config">
                    <div className="trigger-config-l">Listen to event</div>
                    <select className="input" defaultValue="invoice.received">
                      <option value="invoice.received">invoice.received</option>
                      <option value="po.created">po.created</option>
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT: Test bench */}
          <aside className="cap-bench">
            <div className="cap-bench-head">
              <span className="cap-bench-title">{benchOpen ? "Test bench" : "Bench"}</span>
              <button className="cap-bench-toggle" onClick={() => setBenchOpen(!benchOpen)} title={benchOpen ? "Collapse" : "Expand"}>
                <Svg name={benchOpen ? "collapse" : "expand"} className="ico" />
              </button>
            </div>
            {benchOpen && (
              <div className="cap-bench-body">
                <div className="bench-section">
                  <span className="bench-section-l">Sample input</span>
                  <textarea className="bench-input" value={benchInput} onChange={e => setBenchInput(e.target.value)} />
                </div>
                <button className="bench-run" onClick={runBench} disabled={running}>
                  <Svg name="play" className="ico" />
                  {running ? "Running…" : "Run preview"}
                </button>

                <div className="bench-section">
                  <span className="bench-section-l">Output</span>
                  <div className="bench-output">
                    {!benchResult && !running && <div className="bench-output-empty">Run the agent to see trace and final output.</div>}
                    {running && <div className="bench-output-empty">Executing…</div>}
                    {benchResult && (
                      <>
                        <div className="bench-trace">
                          {benchResult.trace.map((t, i) => (
                            <div key={i} className="bench-trace-line">
                              <span className="bench-trace-mark">▸</span>
                              <span className="bench-trace-tag">{t.tag}</span>
                              <span className="bench-trace-text">{t.text}</span>
                            </div>
                          ))}
                        </div>
                        <pre className="bench-output-final">{benchResult.final}</pre>
                      </>
                    )}
                  </div>
                </div>

                <div className="bench-section">
                  <span className="bench-section-l">History</span>
                  <div className="bench-history">
                    {history.map(h => (
                      <div key={h.id} className="bench-history-row">
                        <span className={`bench-history-dot ${h.ok ? "ok" : "err"}`} />
                        <span>{h.summary}</span>
                        <span>{h.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>

        {/* Footer */}
        <div className="cap-footer">
          <div className="cap-footer-status dirty">
            <span className="dot" />
            Draft · Unsaved changes
          </div>
          <div className="cap-footer-actions">
            <button className="btn-secondary" type="button">Save draft</button>
            <button className="btn-primary" type="button">Deploy capability</button>
          </div>
        </div>

        {/* Templates drawer */}
        {drawerOpen && (
          <>
            <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)} />
            <div className="drawer">
              <div className="drawer-head">
                <div>
                  <h3 className="drawer-title">Capability templates</h3>
                  <p className="drawer-sub">Start from a pre-built capability and adapt it to this activity. Templates pre-fill skill, tools, and a starter set of guardrails.</p>
                </div>
                <button className="drawer-close" onClick={() => setDrawerOpen(false)}><Svg name="close" className="ico" /></button>
              </div>
              <div className="drawer-body">
                {D.templates.map(tpl => (
                  <div key={tpl.id} className="template-card" onClick={() => applyTemplate(tpl)}>
                    <div className="template-head">
                      <span className="template-name">{tpl.name}</span>
                      <span className="template-cat">{tpl.category}</span>
                    </div>
                    <div className="template-desc">{tpl.desc}</div>
                    {tpl.tools.length > 0 && (
                      <div className="template-tools">
                        Uses:
                        {tpl.tools.map(t => <span key={t} className="template-tool-pill">{t}</span>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* New tool drawer */}
        {newToolOpen && (
          <>
            <div className="drawer-backdrop" onClick={() => setNewToolOpen(false)} />
            <div className="drawer">
              <div className="drawer-head">
                <div>
                  <h3 className="drawer-title">Create new tool</h3>
                  <p className="drawer-sub">Define a reusable tool the org can attach to any agent. Configure connection details and parameters.</p>
                </div>
                <button className="drawer-close" onClick={() => setNewToolOpen(false)}><Svg name="close" className="ico" /></button>
              </div>
              <div className="drawer-body">
                <div className="tool-form">
                  <div className="field">
                    <label className="field-label">Tool name</label>
                    <input className="input" placeholder="e.g. SAP read invoice" />
                  </div>
                  <div className="field">
                    <label className="field-label">Type</label>
                    <select className="input" defaultValue="rest">
                      <option value="rest">REST API</option>
                      <option value="sql">SQL</option>
                      <option value="function">Function (code)</option>
                      <option value="mcp">MCP server</option>
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label">Description</label>
                    <textarea className="textarea" placeholder="What does this tool do? When should the agent use it?" />
                  </div>
                  <div className="field">
                    <label className="field-label">Endpoint / connection</label>
                    <input className="input" placeholder="https://… or connection string" />
                  </div>
                  <div className="field">
                    <label className="field-label">Authentication</label>
                    <select className="input" defaultValue="oauth">
                      <option value="oauth">OAuth 2.0</option>
                      <option value="bearer">Bearer token</option>
                      <option value="apikey">API key</option>
                      <option value="none">None</option>
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                    <button className="btn-secondary" onClick={() => setNewToolOpen(false)}>Cancel</button>
                    <button className="btn-primary" onClick={() => setNewToolOpen(false)}>Create tool</button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
    </>
  );
}

export default App;
