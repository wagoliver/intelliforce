// Logo exploration canvas — design-canvas with one section per variant
// Each variant gets: mark card · lockup card · scale card · dark card

const { DesignCanvas, DCSection, DCArtboard } = window;

function MarkCard({ Component }) {
  return (
    <div className="logo-card">
      <div className="logo-stage">
        <div className="logo-mark"><Component /></div>
      </div>
      <div></div>
      <div className="logo-foot">
        <div className="logo-name">96 px · primary</div>
        <div className="logo-desc">App icon, hero placement</div>
      </div>
    </div>
  );
}

function LockupCard({ Component }) {
  return (
    <div className="lockup-card">
      <div className="logo-mark"><Component /></div>
      <div className="lockup-word">
        Intelli<span className="force">Force</span>
      </div>
    </div>
  );
}

function ScaleCard({ Component }) {
  const sizes = [
    { cls: "s-16", label: "16 px · favicon" },
    { cls: "s-24", label: "24 px · nav" },
    { cls: "s-32", label: "32 px · header" },
    { cls: "s-48", label: "48 px · brand" },
    { cls: "s-72", label: "72 px · hero" },
  ];
  return (
    <div className="scale-card">
      {sizes.map(s => (
        <div key={s.cls} className="scale-row">
          <div className={s.cls} style={{ width: 96, display: "flex", justifyContent: "flex-start" }}>
            <Component />
          </div>
          <div className="scale-label">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

function DarkCard({ Component }) {
  return (
    <div className="logo-card dark">
      <div className="logo-stage">
        <div className="logo-mark"><Component /></div>
      </div>
      <div></div>
      <div className="logo-foot">
        <div className="logo-name">On dark</div>
        <div className="logo-desc">Same mark, dark surface</div>
      </div>
    </div>
  );
}

function App() {
  return (
    <DesignCanvas
      title="IntelliForce — symbol exploration"
      subtitle="6 abstract geometric marks · institutional indigo · all sized for 16 → 96 px"
    >
      {window.LOGOS.map(logo => (
        <DCSection key={logo.id} id={logo.id} title={logo.name} subtitle={logo.desc}>
          <DCArtboard id={`${logo.id}-mark`} label="Primary mark" width={280} height={320}>
            <MarkCard Component={logo.Component} />
          </DCArtboard>
          <DCArtboard id={`${logo.id}-lockup`} label="Wordmark lockup" width={420} height={160}>
            <LockupCard Component={logo.Component} />
          </DCArtboard>
          <DCArtboard id={`${logo.id}-scale`} label="At every size" width={340} height={420}>
            <ScaleCard Component={logo.Component} />
          </DCArtboard>
          <DCArtboard id={`${logo.id}-dark`} label="On dark" width={280} height={320}>
            <DarkCard Component={logo.Component} />
          </DCArtboard>
        </DCSection>
      ))}
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
