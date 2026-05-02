// IntelliForce — right-side stage (visual hero) with two variants
const { useEffect, useState, useRef } = React;

/* ============================================================
   Headline copy options for the Institutional stage
   ============================================================ */

const HL_STYLE = {
  display: "inline-block",
  padding: "0 10px",
  background: "var(--accent-soft)",
  color: "var(--accent)",
  borderRadius: 999,
  lineHeight: 1.18,
  whiteSpace: "nowrap",
  fontWeight: 600,
};
const HL = (s) => <span style={HL_STYLE}>{s}</span>;

const HEADLINES = {
  "rhythm": {
    label: "1. Rhythm",
    title: <>Your {HL("digital workforce")},<br/>running {HL("24/7")} without missing a beat.</>,
    sub: "Combine AI agents, automations and human teams in one intelligent, scalable and auditable control plane.",
  },
  "scale": {
    label: "2. Human + AI scale",
    title: <>Your team's work,<br/>at the scale of {HL("hundreds of agents")}.</>,
    sub: "Virtual employees that execute, decide and learn alongside your people, with end to end governance.",
  },
  "manifesto": {
    label: "3. Manifesto",
    title: <>Less {HL("repetitive work")}.<br/>More {HL("work that matters")}.</>,
    sub: "IntelliForce automates the operational layer so your team can focus on decisions, relationships and growth.",
  },
  "product": {
    label: "4. Product first",
    title: <>Hire, train and manage {HL("virtual employees")} in minutes.</>,
    sub: "A single platform to orchestrate AI agents ready for your finance, tax and customer operations.",
  },
  "outcome": {
    label: "5. Outcome focused",
    title: <>Every process in your operation,<br/>{HL("automated, audited and at scale")}.</>,
    sub: "AI applied to the back office, with policies, limits and audit trails your risk team will actually approve.",
  },
  "welcome": {
    label: "6. Invitation",
    title: <>Welcome back to the {HL("command")} of your digital operation.</>,
    sub: "Track your agents, automations and teams in real time, with IntelliForce's intelligence at your side.",
  },
};

function StageInstitutional({ headlineKey = "rhythm", atmosphere = "hive" }) {
  const h = HEADLINES[headlineKey] || HEADLINES.rhythm;
  return (
    <div style={instStyles.root}>
      <div style={instStyles.gridBg} />
      <Atmosphere kind={atmosphere} />

      <div style={instStyles.headerRow}>
        <span style={instStyles.eyebrow}>Workforce&nbsp;OS · v4.2</span>
        <span style={instStyles.statusPill}>
          <span style={instStyles.statusDot} />
          All systems operational
        </span>
      </div>

      <div style={instStyles.quote}>
        <p style={instStyles.quoteBody}>{h.title}</p>
        <p style={instStyles.quoteSub}>{h.sub}</p>
      </div>

      <div style={instStyles.certs}>
        <span style={instStyles.certsLabel}>Enterprise grade security</span>
        <div style={instStyles.certsRow}>
          <span style={instStyles.certBadge}>ISO 27001</span>
          <span style={instStyles.certBadge}>SOC 2 Type II</span>
          <span style={instStyles.certBadge}>LGPD</span>
          <span style={instStyles.certBadge}>GDPR</span>
        </div>
      </div>
    </div>
  );
}

function Atmosphere({ kind }) {
  if (kind === "hive") return <HiveAtmosphere />;
  if (kind === "waves") return <WavesAtmosphere />;
  if (kind === "field") return <FieldAtmosphere />;
  return null;
}

// 1) Particle hive — slow drifting points
function HiveAtmosphere() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d");
    let raf, w, h, dpr = window.devicePixelRatio || 1;
    const N = 70;
    const pts = Array.from({ length: N }, () => ({
      x: Math.random(), y: Math.random(),
      vx: (Math.random() - 0.5) * 0.0006,
      vy: (Math.random() - 0.5) * 0.0006,
      r: 1 + Math.random() * 1.6,
      a: 0.3 + Math.random() * 0.5,
    }));
    function resize() {
      w = c.clientWidth; h = c.clientHeight;
      c.width = w * dpr; c.height = h * dpr;
      ctx.scale(dpr, dpr);
    }
    resize();
    window.addEventListener("resize", resize);
    let t = 0;
    function draw() {
      t += 0.004;
      ctx.clearRect(0, 0, w, h);
      const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#4f46e5";
      // links
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const a = pts[i], b = pts[j];
          const dx = (a.x - b.x) * w, dy = (a.y - b.y) * h;
          const d = Math.hypot(dx, dy);
          if (d < 110) {
            ctx.strokeStyle = `color-mix(in oklab, ${accent} ${Math.max(0, (1 - d / 110) * 18)}%, transparent)`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(a.x * w, a.y * h);
            ctx.lineTo(b.x * w, b.y * h);
            ctx.stroke();
          }
        }
      }
      // dots
      for (const p of pts) {
        p.x += p.vx + Math.sin(t + p.r) * 0.00015;
        p.y += p.vy + Math.cos(t + p.r) * 0.00015;
        if (p.x < 0) p.x = 1; if (p.x > 1) p.x = 0;
        if (p.y < 0) p.y = 1; if (p.y > 1) p.y = 0;
        ctx.fillStyle = `color-mix(in oklab, ${accent} ${p.a * 60}%, transparent)`;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} style={atmStyles.canvas} />;
}

// 2) Concentric waves — slow rings expanding from a focal point
function WavesAtmosphere() {
  return (
    <div style={atmStyles.waves}>
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} style={{ ...atmStyles.waveRing, animationDelay: `${i * 1.6}s` }} />
      ))}
    </div>
  );
}

// 3) Field lines — flowing curves like a magnetic field
function FieldAtmosphere() {
  const lines = Array.from({ length: 18 }, (_, i) => i);
  return (
    <svg style={atmStyles.canvas} viewBox="0 0 800 1000" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="fieldFade" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0"/>
          <stop offset="50%" stopColor="var(--accent)" stopOpacity="0.45"/>
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/>
        </linearGradient>
      </defs>
      {lines.map(i => {
        const offset = (i / lines.length) * 800;
        const cx = 400 + (i - lines.length / 2) * 30;
        const d = `M ${offset - 200} 0 C ${cx - 80} 300, ${cx + 80} 700, ${offset + 200} 1000`;
        return (
          <path
            key={i}
            d={d}
            stroke="url(#fieldFade)"
            strokeWidth="0.8"
            fill="none"
            style={{
              animation: `fieldShift 18s ease-in-out infinite alternate`,
              animationDelay: `${(i % 6) * -1.2}s`,
              transformOrigin: "400px 500px",
            }}
          />
        );
      })}
    </svg>
  );
}

const atmStyles = {
  canvas: {
    position: "absolute", inset: 0,
    width: "100%", height: "100%",
    pointerEvents: "none",
    maskImage: "radial-gradient(ellipse at 60% 40%, #000 30%, transparent 80%)",
    WebkitMaskImage: "radial-gradient(ellipse at 60% 40%, #000 30%, transparent 80%)",
  },
  waves: {
    position: "absolute", inset: 0, overflow: "hidden",
    pointerEvents: "none",
  },
  waveRing: {
    position: "absolute",
    top: "50%", left: "60%",
    width: 80, height: 80,
    marginTop: -40, marginLeft: -40,
    borderRadius: "50%",
    border: "1px solid var(--accent)",
    opacity: 0,
    animation: "waveExpand 8s ease-out infinite",
  },
};

function FootStat({ value, label, good }) {
  return (
    <div style={instStyles.footStat}>
      <div style={{ ...instStyles.footStatV, color: good ? "oklch(0.50 0.13 155)" : "var(--text)" }}>{value}</div>
      <div style={instStyles.footStatL}>{label}</div>
    </div>
  );
}

function HoursSavedBlock() {
  const [hours, setHours] = useState(18420);
  useEffect(() => {
    const id = setInterval(() => setHours(h => h + Math.floor(2 + Math.random() * 4)), 1200);
    return () => clearInterval(id);
  }, []);
  const formatted = hours.toLocaleString("en-US");
  return (
    <div style={instStyles.savedBlock}>
      <div style={instStyles.savedHead}>
        <span style={instStyles.savedLabel}>Hours automated this week</span>
        <span style={instStyles.savedTrend}>↑ vs. last week</span>
      </div>
      <div style={instStyles.savedRow}>
        <div style={instStyles.savedValue}>
          {formatted}
          <span style={instStyles.savedUnit}>h</span>
        </div>
        <div style={instStyles.savedBar}>
          <div style={instStyles.savedBarTrack}>
            <div style={{ ...instStyles.savedBarFill, width: "78%" }} />
          </div>
          <div style={instStyles.savedBarLabels}>
            <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
          </div>
        </div>
      </div>
      <div style={instStyles.savedFoot}>
        Equivalent to <strong style={{ color: "var(--text)" }}>~115 full‑time analysts</strong> off repetitive work this week.
      </div>
    </div>
  );
}

const ACTIVITIES = [
  { agent: "AGT‑0431", action: "Reconciled 1,284 invoices", area: "Finance", t: "just now", state: "ok" },
  { agent: "AGT‑1108", action: "Onboarded 12 new vendors", area: "Procurement", t: "12s", state: "ok" },
  { agent: "AGT‑0277", action: "Closed P1 ticket in 4.2s", area: "Support", t: "38s", state: "ok" },
  { agent: "AGT‑2044", action: "Flagged 3 anomalies for review", area: "Risk", t: "1m", state: "warn" },
];

function ActivityFeed() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 3200);
    return () => clearInterval(id);
  }, []);
  // rotate window
  const start = tick % ACTIVITIES.length;
  const rows = [0, 1, 2].map(i => ACTIVITIES[(start + i) % ACTIVITIES.length]);

  const areaColor = (a) => ({
    Finance: "oklch(0.55 0.13 265)",
    Procurement: "oklch(0.55 0.13 200)",
    Support: "oklch(0.55 0.13 155)",
    Risk: "oklch(0.62 0.15 70)",
  }[a] || "var(--text-muted)");

  return (
    <div style={instStyles.feed}>
      {rows.map((r, i) => (
        <div key={`${tick}-${i}`} style={{
          ...instStyles.feedRow,
          opacity: 1 - i * 0.18,
          animation: i === 0 ? "feedIn 480ms ease-out both" : "none",
        }}>
          <div style={{ ...instStyles.feedDot, background: areaColor(r.area) }} />
          <div style={instStyles.feedAgent}>{r.agent}</div>
          <div style={instStyles.feedAction}>{r.action}</div>
          <div style={{ ...instStyles.feedArea, color: areaColor(r.area), borderColor: areaColor(r.area) }}>{r.area}</div>
          <div style={instStyles.feedTime}>{r.t}</div>
        </div>
      ))}
    </div>
  );
}

const instStyles = {
  root: {
    position: "absolute", inset: 0,
    padding: 48,
    display: "flex", flexDirection: "column", gap: 24,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
  },
  gridBg: {
    position: "absolute", inset: 0,
    backgroundImage:
      "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
    backgroundSize: "44px 44px",
    maskImage: "radial-gradient(ellipse at 60% 40%, #000 30%, transparent 75%)",
    WebkitMaskImage: "radial-gradient(ellipse at 60% 40%, #000 30%, transparent 75%)",
    opacity: 0.55,
    pointerEvents: "none",
  },
  headerRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    position: "absolute", top: 48, left: 48, right: 48,
    zIndex: 1,
  },
  eyebrow: {
    fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.04em",
    color: "var(--text-subtle)",
  },
  statusPill: {
    display: "inline-flex", alignItems: "center", gap: 8,
    padding: "5px 10px", borderRadius: 999,
    background: "var(--bg-elev)", border: "1px solid var(--border)",
    fontSize: 11.5, color: "var(--text-muted)",
  },
  statusDot: {
    width: 7, height: 7, borderRadius: "50%",
    background: "oklch(0.55 0.13 155)",
    boxShadow: "0 0 0 4px color-mix(in oklab, oklch(0.55 0.13 155) 18%, transparent)",
  },
  quote: {
    position: "relative", zIndex: 1,
    maxWidth: 520,
  },
  quoteBody: {
    fontFamily: "var(--font-display)", fontSize: 36, lineHeight: 1.15,
    letterSpacing: "-0.025em", color: "var(--text)", margin: 0,
    textWrap: "balance", fontWeight: 600,
  },
  quoteSub: {
    fontSize: 15, lineHeight: 1.55,
    color: "var(--text-muted)", margin: "16px auto 0",
    textWrap: "pretty", maxWidth: 440,
  },
  pillHl: {
    display: "inline-block",
    padding: "0 10px",
    background: "var(--accent-soft)",
    color: "var(--accent)",
    borderRadius: 999,
    lineHeight: 1.18,
    whiteSpace: "nowrap",
    fontWeight: 600,
  },
  kpiCard: {
    position: "relative", zIndex: 1,
    background: "var(--bg-elev)",
    border: "1px solid var(--border)",
    borderRadius: 14,
    padding: 20,
    boxShadow: "var(--shadow)",
    marginTop: "auto",
  },
  kpiHead: {
    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
    marginBottom: 16,
    gap: 12,
  },
  kpiTitle: {
    fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600,
    letterSpacing: "-0.012em", color: "var(--text)",
  },
  kpiSub: {
    fontSize: 12, color: "var(--text-muted)", marginTop: 2,
  },
  kpiLive: {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "3px 8px", borderRadius: 999,
    background: "color-mix(in oklab, oklch(0.55 0.13 155) 12%, transparent)",
    color: "oklch(0.45 0.13 155)",
    fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
    letterSpacing: "0.08em", flexShrink: 0,
  },
  kpiLiveDot: {
    width: 6, height: 6, borderRadius: "50%",
    background: "oklch(0.55 0.13 155)",
    animation: "pulse 1.6s ease-out infinite",
  },
  feed: {
    display: "flex", flexDirection: "column", gap: 6,
    paddingBottom: 14, marginBottom: 14,
    borderBottom: "1px solid var(--border)",
  },
  savedBlock: {
    padding: "14px 16px",
    background: "color-mix(in oklab, var(--accent) 6%, var(--bg-elev))",
    border: "1px solid color-mix(in oklab, var(--accent) 18%, var(--border))",
    borderRadius: 10,
    marginBottom: 14,
  },
  savedHead: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginBottom: 8,
  },
  savedLabel: {
    fontSize: 11.5, color: "var(--text-muted)", fontWeight: 500,
    letterSpacing: "0.02em",
  },
  savedTrend: {
    fontSize: 10.5, fontFamily: "var(--font-mono)",
    color: "oklch(0.50 0.13 155)", fontWeight: 600,
  },
  savedRow: {
    display: "grid", gridTemplateColumns: "auto 1fr", gap: 18,
    alignItems: "center",
  },
  savedValue: {
    fontFamily: "var(--font-display)", fontSize: 34, fontWeight: 700,
    letterSpacing: "-0.03em", color: "var(--accent)",
    fontVariantNumeric: "tabular-nums",
    display: "flex", alignItems: "baseline", gap: 4,
  },
  savedUnit: {
    fontSize: 16, fontWeight: 500, color: "var(--text-muted)",
    letterSpacing: "-0.01em",
  },
  savedBar: { display: "flex", flexDirection: "column", gap: 6 },
  savedBarTrack: {
    height: 6, borderRadius: 3,
    background: "color-mix(in oklab, var(--accent) 14%, transparent)",
    overflow: "hidden",
  },
  savedBarFill: {
    height: "100%",
    background: "linear-gradient(90deg, color-mix(in oklab, var(--accent) 60%, transparent), var(--accent))",
    borderRadius: 3,
  },
  savedBarLabels: {
    display: "flex", justifyContent: "space-between",
    fontSize: 9.5, fontFamily: "var(--font-mono)",
    color: "var(--text-subtle)", letterSpacing: "0.04em",
  },
  savedFoot: {
    marginTop: 10, fontSize: 12, color: "var(--text-muted)",
    lineHeight: 1.45,
  },
  feedRow: {
    display: "grid",
    gridTemplateColumns: "8px 70px 1fr auto auto",
    alignItems: "center",
    gap: 10,
    fontSize: 12.5,
    padding: "4px 0",
  },
  feedDot: {
    width: 6, height: 6, borderRadius: "50%",
  },
  feedAgent: {
    fontFamily: "var(--font-mono)", fontSize: 11,
    color: "var(--text-subtle)", letterSpacing: "-0.01em",
  },
  feedAction: {
    color: "var(--text)", fontWeight: 500,
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  feedArea: {
    fontSize: 10, padding: "2px 7px", borderRadius: 4,
    border: "1px solid", background: "transparent",
    fontWeight: 600, letterSpacing: "0.02em",
  },
  feedTime: {
    fontFamily: "var(--font-mono)", fontSize: 10.5,
    color: "var(--text-subtle)", minWidth: 38, textAlign: "right",
  },
  kpiFootRow: {
    display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16,
  },
  footStat: { display: "flex", flexDirection: "column", gap: 2 },
  footStatV: {
    fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600,
    letterSpacing: "-0.02em",
  },
  footStatL: {
    fontSize: 11, color: "var(--text-subtle)",
  },
  certs: {
    position: "absolute", zIndex: 1,
    bottom: 48, left: 48, right: 48,
    display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
  },
  certsLabel: {
    fontSize: 11, color: "var(--text-subtle)", letterSpacing: "0.06em",
    textTransform: "uppercase", fontWeight: 500,
  },
  certsRow: {
    display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center",
  },
  certBadge: {
    fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500,
    padding: "5px 10px", borderRadius: 6,
    background: "var(--bg-elev)",
    border: "1px solid var(--border)",
    color: "var(--text-muted)",
    letterSpacing: "0.02em",
  },
  // legacy retained for any references
  kpiCard: { display: "none" },
  kpiHead: {}, kpiTitle: {}, kpiSub: {}, kpiLive: {}, kpiLiveDot: {},
  feed: { display: "none" },
  feedRow: {}, feedDot: {}, feedAgent: {}, feedAction: {}, feedArea: {}, feedTime: {},
  kpiFootRow: { display: "none" },
  footStat: {}, footStatV: {}, footStatL: {},
  savedBlock: { display: "none" },
  savedHead: {}, savedLabel: {}, savedTrend: {},
  savedRow: {}, savedValue: {}, savedUnit: {},
  savedBar: {}, savedBarTrack: {}, savedBarFill: {}, savedBarLabels: {},
  savedFoot: {},
  logoStrip: { display: "none" },
  logoStripLabel: {}, logoRow: {}, logoMark: {},
  logoStrip: { position: "relative", zIndex: 1 },
  logoStripLabel: { fontSize: 11, color: "var(--text-subtle)", letterSpacing: "0.04em" },
  logoRow: {
    display: "flex", gap: 28, marginTop: 10, flexWrap: "wrap",
  },
  logoMark: {
    fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.04em",
    fontSize: 13, color: "var(--text-muted)", opacity: 0.7,
  },
};

/* ============================================================
   Variant B — Operations canvas (dark)
   Live "agent ops" board: agents, throughput, mission log
   ============================================================ */

function StageOperations() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1400);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={opsStyles.root}>
      <div style={opsStyles.bgGlow} />
      <div style={opsStyles.gridBg} />

      <div style={opsStyles.head}>
        <div style={opsStyles.headLeft}>
          <span style={opsStyles.headDot} />
          <span style={opsStyles.headTitle}>Operations Canvas</span>
          <span style={opsStyles.headSep}>/</span>
          <span style={opsStyles.headSub}>São Paulo · Region BR‑1</span>
        </div>
        <span style={opsStyles.headTime}>{new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
      </div>

      <div style={opsStyles.statRow}>
        <OpsStat label="Agents online" value="2,418" trend="+12" />
        <OpsStat label="Tasks / min" value="1,094" trend="+86" pulse />
        <OpsStat label="SLA met" value="99.94%" trend="green" />
      </div>

      <AgentMatrix tick={tick} />

      <ThroughputChart tick={tick} />

      <MissionLog tick={tick} />
    </div>
  );
}

function OpsStat({ label, value, trend, pulse }) {
  return (
    <div style={opsStyles.stat}>
      <div style={opsStyles.statL}>{label}</div>
      <div style={opsStyles.statV}>
        {value}
        {pulse && <span style={opsStyles.pulseDot} />}
      </div>
      <div style={{
        ...opsStyles.statT,
        color: trend === "green" ? "oklch(0.78 0.16 155)" : "oklch(0.78 0.13 265)",
      }}>{trend === "green" ? "▲ on target" : `▲ ${trend}`}</div>
    </div>
  );
}

function AgentMatrix({ tick }) {
  // 8x14 grid of agent cells, each with a slot status
  const COLS = 14, ROWS = 6;
  const cells = [];
  for (let i = 0; i < COLS * ROWS; i++) {
    // Deterministic-ish state per tick
    const seed = (i * 9301 + tick * 49297) % 233280;
    const r = seed / 233280;
    let state = "idle";
    if (r < 0.55) state = "busy";
    else if (r < 0.62) state = "warn";
    else if (r < 0.68) state = "complete";
    cells.push(state);
  }
  const colorOf = (s) => ({
    idle: "oklch(0.30 0.014 255)",
    busy: "oklch(0.62 0.13 265)",
    warn: "oklch(0.72 0.16 70)",
    complete: "oklch(0.68 0.16 155)",
  }[s]);

  return (
    <div style={opsStyles.matrixWrap}>
      <div style={opsStyles.matrixHead}>
        <span style={opsStyles.matrixTitle}>Agent fleet</span>
        <div style={opsStyles.legend}>
          <Legend color="oklch(0.62 0.13 265)" label="Working" />
          <Legend color="oklch(0.68 0.16 155)" label="Done" />
          <Legend color="oklch(0.72 0.16 70)" label="Review" />
          <Legend color="oklch(0.30 0.014 255)" label="Idle" />
        </div>
      </div>
      <div style={{ ...opsStyles.matrix, gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
        {cells.map((s, i) => (
          <div key={i} style={{
            aspectRatio: "1",
            background: colorOf(s),
            borderRadius: 3,
            transition: "background 400ms ease",
            boxShadow: s === "busy" ? "0 0 8px color-mix(in oklab, oklch(0.62 0.13 265) 60%, transparent)" : "none",
          }} />
        ))}
      </div>
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <span style={opsStyles.legendItem}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
      {label}
    </span>
  );
}

function ThroughputChart({ tick }) {
  // moving sparkline
  const N = 40;
  const data = Array.from({ length: N }, (_, i) => {
    const t = (i + tick) * 0.45;
    return 50 + Math.sin(t) * 18 + Math.sin(t * 1.7) * 12 + Math.sin(t * 0.3) * 8;
  });
  const max = Math.max(...data);
  const min = Math.min(...data);
  const points = data.map((v, i) => {
    const x = (i / (N - 1)) * 100;
    const y = 100 - ((v - min) / (max - min)) * 100;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div style={opsStyles.chartCard}>
      <div style={opsStyles.chartHead}>
        <div>
          <div style={opsStyles.chartLabel}>Throughput · tasks/min</div>
          <div style={opsStyles.chartValue}>{Math.round(data[data.length - 1] * 18)}</div>
        </div>
        <div style={opsStyles.chartRange}>last 40m</div>
      </div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={opsStyles.chartSvg}>
        <defs>
          <linearGradient id="tput" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.72 0.13 265)" stopOpacity="0.45"/>
            <stop offset="100%" stopColor="oklch(0.72 0.13 265)" stopOpacity="0"/>
          </linearGradient>
        </defs>
        <polygon points={`0,100 ${points} 100,100`} fill="url(#tput)" />
        <polyline points={points} fill="none" stroke="oklch(0.78 0.13 265)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

function MissionLog({ tick }) {
  const entries = [
    { t: "00:02", k: "AGT‑0431", m: "Reconciled 1,284 invoices · ledger Q2", s: "ok" },
    { t: "00:05", k: "AGT‑1108", m: "Onboarded 12 new vendors via SAP", s: "ok" },
    { t: "00:09", k: "AGT‑0277", m: "Flagged 3 anomalies for human review", s: "warn" },
    { t: "00:14", k: "AGT‑2044", m: "Closed P1 ticket · 4.2s handle time", s: "ok" },
  ];
  // animate in based on tick
  return (
    <div style={opsStyles.log}>
      <div style={opsStyles.logHead}>
        <span style={opsStyles.matrixTitle}>Mission log</span>
        <span style={opsStyles.logFollow}>● tailing</span>
      </div>
      {entries.map((e, i) => (
        <div key={i} style={{
          ...opsStyles.logRow,
          opacity: 1 - i * 0.16,
        }}>
          <span style={opsStyles.logT}>{e.t}</span>
          <span style={opsStyles.logK}>{e.k}</span>
          <span style={opsStyles.logM}>{e.m}</span>
          <span style={{
            ...opsStyles.logS,
            background: e.s === "ok" ? "oklch(0.30 0.10 155)" : "oklch(0.32 0.10 70)",
            color: e.s === "ok" ? "oklch(0.85 0.15 155)" : "oklch(0.85 0.15 70)",
          }}>{e.s === "ok" ? "OK" : "REVIEW"}</span>
        </div>
      ))}
    </div>
  );
}

const opsStyles = {
  root: {
    position: "absolute", inset: 0,
    padding: 40,
    display: "flex", flexDirection: "column", gap: 18,
    color: "oklch(0.96 0.005 255)",
    overflow: "hidden",
  },
  bgGlow: {
    position: "absolute", top: -120, right: -120,
    width: 480, height: 480, borderRadius: "50%",
    background: "radial-gradient(circle, oklch(0.42 0.18 265 / 0.45), transparent 70%)",
    pointerEvents: "none",
  },
  gridBg: {
    position: "absolute", inset: 0,
    backgroundImage:
      "linear-gradient(oklch(0.22 0.014 255) 1px, transparent 1px), linear-gradient(90deg, oklch(0.22 0.014 255) 1px, transparent 1px)",
    backgroundSize: "32px 32px",
    maskImage: "radial-gradient(ellipse at 50% 30%, #000 30%, transparent 75%)",
    WebkitMaskImage: "radial-gradient(ellipse at 50% 30%, #000 30%, transparent 75%)",
    opacity: 0.6,
    pointerEvents: "none",
  },
  head: {
    position: "relative", zIndex: 1,
    display: "flex", justifyContent: "space-between", alignItems: "center",
  },
  headLeft: { display: "flex", alignItems: "center", gap: 8, fontSize: 12 },
  headDot: {
    width: 7, height: 7, borderRadius: "50%",
    background: "oklch(0.78 0.16 155)",
    boxShadow: "0 0 0 4px color-mix(in oklab, oklch(0.78 0.16 155) 18%, transparent)",
  },
  headTitle: { fontWeight: 600, color: "oklch(0.96 0.005 255)" },
  headSep: { color: "oklch(0.45 0.014 255)" },
  headSub: { color: "oklch(0.65 0.012 255)" },
  headTime: {
    fontFamily: "var(--font-mono)", fontSize: 11,
    color: "oklch(0.65 0.012 255)", letterSpacing: "0.04em",
  },
  statRow: {
    position: "relative", zIndex: 1,
    display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12,
  },
  stat: {
    background: "oklch(0.20 0.014 255 / 0.7)",
    border: "1px solid oklch(0.28 0.014 255)",
    borderRadius: 10,
    padding: "14px 16px",
    backdropFilter: "blur(8px)",
  },
  statL: { fontSize: 11, color: "oklch(0.65 0.012 255)", marginBottom: 4 },
  statV: {
    fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600,
    letterSpacing: "-0.02em", color: "oklch(0.96 0.005 255)",
    display: "flex", alignItems: "center", gap: 8,
  },
  statT: { fontSize: 11, fontFamily: "var(--font-mono)", marginTop: 2 },
  pulseDot: {
    width: 8, height: 8, borderRadius: "50%",
    background: "oklch(0.78 0.16 155)",
    animation: "pulse 1.6s ease-out infinite",
  },
  matrixWrap: { position: "relative", zIndex: 1 },
  matrixHead: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginBottom: 10,
  },
  matrixTitle: {
    fontSize: 11, letterSpacing: "0.10em", textTransform: "uppercase",
    color: "oklch(0.65 0.012 255)", fontWeight: 600,
  },
  legend: { display: "flex", gap: 12 },
  legendItem: {
    display: "inline-flex", alignItems: "center", gap: 6,
    fontSize: 11, color: "oklch(0.72 0.012 255)",
  },
  matrix: {
    display: "grid", gap: 4,
    padding: 10,
    background: "oklch(0.18 0.012 255)",
    border: "1px solid oklch(0.24 0.014 255)",
    borderRadius: 8,
  },
  chartCard: {
    position: "relative", zIndex: 1,
    background: "oklch(0.20 0.014 255 / 0.7)",
    border: "1px solid oklch(0.28 0.014 255)",
    borderRadius: 10,
    padding: 14,
    backdropFilter: "blur(8px)",
  },
  chartHead: {
    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
    marginBottom: 6,
  },
  chartLabel: { fontSize: 11, color: "oklch(0.65 0.012 255)" },
  chartValue: {
    fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600,
    letterSpacing: "-0.02em",
  },
  chartRange: {
    fontFamily: "var(--font-mono)", fontSize: 10.5,
    color: "oklch(0.55 0.012 255)",
  },
  chartSvg: { width: "100%", height: 60, display: "block" },
  log: {
    position: "relative", zIndex: 1,
    background: "oklch(0.20 0.014 255 / 0.7)",
    border: "1px solid oklch(0.28 0.014 255)",
    borderRadius: 10,
    padding: 14,
    backdropFilter: "blur(8px)",
  },
  logHead: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginBottom: 10,
  },
  logFollow: {
    fontFamily: "var(--font-mono)", fontSize: 10.5,
    color: "oklch(0.78 0.16 155)", letterSpacing: "0.04em",
  },
  logRow: {
    display: "grid",
    gridTemplateColumns: "44px 80px 1fr 70px",
    gap: 10,
    alignItems: "center",
    fontSize: 12,
    fontFamily: "var(--font-mono)",
    padding: "5px 0",
    borderTop: "1px dashed oklch(0.28 0.014 255)",
  },
  logT: { color: "oklch(0.55 0.012 255)" },
  logK: { color: "oklch(0.78 0.13 265)", fontWeight: 600 },
  logM: {
    color: "oklch(0.85 0.008 255)",
    fontFamily: "var(--font-sans)",
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  logS: {
    fontSize: 10, padding: "2px 6px", borderRadius: 4,
    textAlign: "center", fontWeight: 600, letterSpacing: "0.04em",
  },
};

Object.assign(window, { StageInstitutional, StageOperations, HEADLINES });
