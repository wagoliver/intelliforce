// Notched Square refinement canvas

const { DesignCanvas, DCSection, DCArtboard } = window;

function MarkCard({ Component }) {
  return (
    <div className="logo-card">
      <div className="logo-stage">
        <div className="logo-mark"><Component /></div>
      </div>
      <div></div>
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
    { px: 16, label: "16 px · favicon" },
    { px: 24, label: "24 px · nav" },
    { px: 32, label: "32 px · header" },
    { px: 48, label: "48 px · brand" },
  ];
  return (
    <div className="scale-card" style={{ gap: 18 }}>
      {sizes.map(s => (
        <div key={s.px} className="scale-row">
          <div style={{ width: 56, display: "flex", justifyContent: "center" }}>
            <div style={{ width: s.px, height: s.px }}><Component /></div>
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
    </div>
  );
}

function App() {
  return (
    <DesignCanvas
      title="Notched Square — refinements"
      subtitle="12 variations on the selected mark · same indigo · same 64×64 grid"
    >
      {window.NOTCHED_VARIANTS.map(v => (
        <DCSection key={v.id} id={v.id} title={v.name} subtitle={v.desc}>
          <DCArtboard id={`${v.id}-mark`} label="Mark" width={240} height={240}>
            <MarkCard Component={v.Component} />
          </DCArtboard>
          <DCArtboard id={`${v.id}-lockup`} label="Lockup" width={400} height={140}>
            <LockupCard Component={v.Component} />
          </DCArtboard>
          <DCArtboard id={`${v.id}-scale`} label="At every size" width={300} height={320}>
            <ScaleCard Component={v.Component} />
          </DCArtboard>
          <DCArtboard id={`${v.id}-dark`} label="On dark" width={240} height={240}>
            <DarkCard Component={v.Component} />
          </DCArtboard>
        </DCSection>
      ))}
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
