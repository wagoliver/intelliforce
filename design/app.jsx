// IntelliForce — main login app (English)
const { useState, useEffect, useRef, useMemo } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "variant": "institutional",
  "theme": "light",
  "showStage": true,
  "primaryHue": 265,
  "motionLevel": "subtle",
  "ssoFirst": true,
  "headlineCopy": "Sign in to your digital workforce.",
  "showStatusBadge": true,
  "headlineKey": "rhythm",
  "atmosphere": "hive"
}/*EDITMODE-END*/;

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = tweaks.theme;
    root.dataset.variant = tweaks.variant;
    const h = tweaks.primaryHue;
    if (tweaks.theme === "dark") {
      root.style.setProperty("--accent", `oklch(0.72 0.13 ${h})`);
      root.style.setProperty("--accent-hover", `oklch(0.78 0.13 ${h})`);
      root.style.setProperty("--accent-soft", `oklch(0.28 0.06 ${h})`);
    } else {
      root.style.setProperty("--accent", `oklch(0.42 0.13 ${h})`);
      root.style.setProperty("--accent-hover", `oklch(0.36 0.13 ${h})`);
      root.style.setProperty("--accent-soft", `oklch(0.96 0.02 ${h})`);
    }
  }, [tweaks.theme, tweaks.variant, tweaks.primaryHue]);

  const effectiveTheme = tweaks.variant === "operations" ? "dark" : tweaks.theme;
  useEffect(() => {
    document.documentElement.dataset.theme = effectiveTheme;
  }, [effectiveTheme]);

  const [step, setStep] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [emailErr, setEmailErr] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef([]);

  function validate() {
    let ok = true;
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setEmailErr("Please enter a valid work email."); ok = false;
    } else setEmailErr("");
    if (!password || password.length < 6) {
      setPwErr("Password must be at least 6 characters."); ok = false;
    } else setPwErr("");
    return ok;
  }

  function submitLogin(e) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setTimeout(() => { setLoading(false); setStep("2fa"); }, 900);
  }

  function submitOtp(e) {
    e.preventDefault();
    if (otp.some(c => !c)) return;
    setLoading(true);
    setTimeout(() => { setLoading(false); setStep("success"); }, 800);
  }

  function handleOtpChange(i, v) {
    v = v.replace(/\D/g, "").slice(0, 1);
    const next = [...otp]; next[i] = v; setOtp(next);
    if (v && i < 5) otpRefs.current[i + 1]?.focus();
  }
  function handleOtpKey(i, e) {
    if (e.key === "Backspace" && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
  }
  function handleOtpPaste(e) {
    const t = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6);
    if (!t) return;
    e.preventDefault();
    const next = [...otp];
    for (let i = 0; i < 6; i++) next[i] = t[i] || "";
    setOtp(next);
    otpRefs.current[Math.min(t.length, 5)]?.focus();
  }

  return (
    <div className="page" data-variant={tweaks.variant}>
      <div className="form-col">
        <BrandRow showBadge={tweaks.showStatusBadge} />

        <div className="form-wrap">
          <div className="form-card">
            {step === "login" && (
              <LoginStep
                tweaks={tweaks}
                email={email} setEmail={setEmail}
                password={password} setPassword={setPassword}
                showPw={showPw} setShowPw={setShowPw}
                remember={remember} setRemember={setRemember}
                emailErr={emailErr} pwErr={pwErr}
                loading={loading}
                onSubmit={submitLogin}
                onForgot={() => setStep("forgot")}
              />
            )}
            {step === "2fa" && (
              <OtpStep
                email={email}
                otp={otp} otpRefs={otpRefs}
                onChange={handleOtpChange} onKey={handleOtpKey} onPaste={handleOtpPaste}
                loading={loading} onSubmit={submitOtp}
                onBack={() => setStep("login")}
              />
            )}
            {step === "forgot" && (
              <ForgotStep
                email={email} setEmail={setEmail}
                onSubmit={(e) => { e.preventDefault(); setStep("forgot-sent"); }}
                onBack={() => setStep("login")}
              />
            )}
            {step === "forgot-sent" && (
              <ForgotSentStep email={email} onBack={() => setStep("login")} />
            )}
            {step === "success" && <SuccessStep onReset={() => { setStep("login"); setOtp(["","","","","",""]); }} />}
          </div>
        </div>

        <FootBar />
      </div>

      {tweaks.showStage && (
        <div className="stage-col">
          {tweaks.variant === "operations" ? <StageOperations /> : <StageInstitutional headlineKey={tweaks.headlineKey} atmosphere={tweaks.atmosphere} />}
        </div>
      )}

      <TweaksUI tweaks={tweaks} setTweak={setTweak} />
    </div>
  );
}

function BrandRow({ showBadge }) {
  return (
    <div className="brand-row">
      <div className="brand-mark">
        <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-label="IntelliForce">
          <path d="M10 10 H54 V54 H10 Z M22 22 V42 H42 V22 Z" fill="currentColor" fillRule="evenodd" />
        </svg>
      </div>
      <div className="brand-name">
        IntelliForce
        {showBadge && <span className="pill">Workforce&nbsp;OS</span>}
      </div>
    </div>
  );
}

function LoginStep({
  tweaks, email, setEmail, password, setPassword,
  showPw, setShowPw, remember, setRemember,
  emailErr, pwErr, loading, onSubmit, onForgot,
}) {
  const sso = (
    <div className="sso-row">
      <SSOButton icon={<SSOMicrosoftIcon className="sso-icon" />} label="Continue with Microsoft" meta="SSO" />
      <SSOButton icon={<SSOGoogleIcon className="sso-icon" />} label="Continue with Google" meta="SSO" />
    </div>
  );

  const credentials = (
    <form onSubmit={onSubmit} noValidate>
      <div className="field">
        <div className="field-label"><span>Work email</span></div>
        <div className="input-wrap">
          <Icon.Mail className="leading-icon" />
          <input
            className={`input ${emailErr ? "error" : ""}`}
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        {emailErr && <div className="field-error">{emailErr}</div>}
      </div>

      <div className="field">
        <div className="field-label">
          <span>Password</span>
          <a href="#" className="help" onClick={(e) => { e.preventDefault(); onForgot(); }}>Forgot password?</a>
        </div>
        <div className="input-wrap">
          <Icon.Lock className="leading-icon" />
          <input
            className={`input ${pwErr ? "error" : ""}`}
            type={showPw ? "text" : "password"}
            placeholder="••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <button type="button" className="trailing-btn" onClick={() => setShowPw(s => !s)} aria-label="Show password">
            {showPw ? <Icon.EyeOff style={{ width: 16, height: 16 }}/> : <Icon.Eye style={{ width: 16, height: 16 }}/>}
          </button>
        </div>
        {pwErr && <div className="field-error">{pwErr}</div>}
      </div>

      <div className="row-between">
        <label className="checkbox">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <span className="box"><Icon.Check /></span>
          Keep me signed in on this device
        </label>
      </div>

      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? <><span className="spinner"/> Verifying…</> : <>Sign in <Icon.Arrow style={{ width: 16, height: 16 }}/></>}
      </button>
    </form>
  );

  return (
    <>
      <div className="form-eyebrow">Secure access</div>
      <h1 className="form-title">{tweaks.headlineCopy}</h1>
      <p className="form-sub">
        Orchestrate your AI agents, automations and human teams from a single control plane.
      </p>

      {tweaks.ssoFirst ? <>{sso}<div className="divider">or continue with email</div>{credentials}</>
                       : <>{credentials}<div className="divider">or use SSO</div>{sso}</>}

      <div className="form-foot">
        <span>New to IntelliForce? <a href="#">Request access</a></span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}>
          <Icon.Shield style={{ width: 14, height: 14 }}/>
          ISO 27001 · SOC 2
        </span>
      </div>

      <div className="mobile-teaser">
        <span className="pulse" />
        <div>
          <strong style={{ color: "var(--text)" }}>2,418 active agents</strong> processing 1,094 tasks/min right now.
        </div>
      </div>
    </>
  );
}

function OtpStep({ email, otp, otpRefs, onChange, onKey, onPaste, loading, onSubmit, onBack }) {
  return (
    <>
      <button className="btn-ghost" onClick={onBack} style={{ marginBottom: 18, marginLeft: -10 }}>
        <Icon.Back style={{ width: 14, height: 14 }}/> Back
      </button>
      <div className="form-eyebrow">Two factor authentication</div>
      <h1 className="form-title">Verify it's you</h1>
      <p className="form-sub">
        We sent a 6 digit code to <strong style={{ color: "var(--text)" }}>{email || "your authenticator"}</strong>. Enter it below to continue.
      </p>

      <div className="notice">
        <span className="dot" />
        <span><strong>Microsoft Authenticator</strong> approved, expires in 04:52</span>
      </div>

      <form onSubmit={onSubmit}>
        <div className="otp-row" onPaste={onPaste}>
          {otp.map((v, i) => (
            <input
              key={i}
              ref={(el) => (otpRefs.current[i] = el)}
              className={`otp-input ${v ? "filled" : ""}`}
              maxLength={1}
              value={v}
              onChange={(e) => onChange(i, e.target.value)}
              onKeyDown={(e) => onKey(i, e)}
              inputMode="numeric"
            />
          ))}
        </div>
        <button type="submit" className="btn-primary" disabled={loading || otp.some(c => !c)}>
          {loading ? <><span className="spinner"/> Validating…</> : <>Verify and sign in <Icon.Arrow style={{ width: 16, height: 16 }}/></>}
        </button>
      </form>

      <div className="form-foot">
        <span>Didn't receive it? <a href="#">Resend code</a></span>
        <a href="#" style={{ color: "var(--text-muted)" }}>Use a security key</a>
      </div>
    </>
  );
}

function ForgotStep({ email, setEmail, onSubmit, onBack }) {
  return (
    <>
      <button className="btn-ghost" onClick={onBack} style={{ marginBottom: 18, marginLeft: -10 }}>
        <Icon.Back style={{ width: 14, height: 14 }}/> Back to sign in
      </button>
      <div className="form-eyebrow">Recovery</div>
      <h1 className="form-title">Reset your password</h1>
      <p className="form-sub">
        Enter the email tied to your account and we'll send a secure link to choose a new password.
      </p>
      <form onSubmit={onSubmit}>
        <div className="field">
          <div className="field-label"><span>Work email</span></div>
          <div className="input-wrap">
            <Icon.Mail className="leading-icon" />
            <input
              className="input"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </div>
        </div>
        <button type="submit" className="btn-primary">Send recovery link <Icon.Arrow style={{ width: 16, height: 16 }}/></button>
      </form>
    </>
  );
}

function ForgotSentStep({ email, onBack }) {
  return (
    <>
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: "var(--accent-soft)", color: "var(--accent)",
        display: "grid", placeItems: "center", marginBottom: 18,
      }}>
        <Icon.Mail style={{ width: 22, height: 22 }}/>
      </div>
      <h1 className="form-title">Check your email</h1>
      <p className="form-sub">
        If an account is linked to <strong style={{ color: "var(--text)" }}>{email || "that email"}</strong>, a reset link is on its way.
      </p>
      <button className="btn-primary" onClick={onBack}>Back to sign in</button>
      <div className="form-foot">
        <span>Didn't get it after a few minutes? <a href="#">Try again</a></span>
      </div>
    </>
  );
}

function SuccessStep({ onReset }) {
  return (
    <>
      <div style={{
        width: 56, height: 56, borderRadius: 14,
        background: "color-mix(in oklab, oklch(0.55 0.13 155) 20%, transparent)",
        color: "oklch(0.55 0.13 155)",
        display: "grid", placeItems: "center", marginBottom: 18,
      }}>
        <Icon.Check style={{ width: 28, height: 28 }}/>
      </div>
      <h1 className="form-title">Welcome back</h1>
      <p className="form-sub">We're preparing your dashboard. Your digital workforce has 12 updates since your last session.</p>
      <button className="btn-primary" onClick={onReset}>Enter dashboard <Icon.Arrow style={{ width: 16, height: 16 }}/></button>
    </>
  );
}

function FootBar() {
  return (
    <div className="foot-bar">
      <span>© 2026 IntelliForce Technologies, Inc.</span>
      <nav>
        <a href="#">Privacy</a>
        <a href="#">Terms</a>
        <a href="#">Status</a>
        <a href="#">Support</a>
      </nav>
    </div>
  );
}

function TweaksUI({ tweaks, setTweak }) {
  return (
    <TweaksPanel title="Tweaks">
      <TweakSection title="Visual direction">
        <TweakRadio
          label="Variant"
          value={tweaks.variant}
          onChange={(v) => setTweak("variant", v)}
          options={[
            { value: "institutional", label: "Institutional" },
            { value: "operations", label: "Ops Canvas" },
          ]}
        />
        {tweaks.variant === "institutional" && (
          <TweakRadio
            label="Theme"
            value={tweaks.theme}
            onChange={(v) => setTweak("theme", v)}
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
        )}
        <TweakSlider
          label="Accent hue"
          min={200} max={340} step={5}
          value={tweaks.primaryHue}
          onChange={(v) => setTweak("primaryHue", v)}
          format={(v) => `${v}°`}
        />
      </TweakSection>

      <TweakSection title="Layout">
        <TweakRadio
          label="Atmosphere"
          value={tweaks.atmosphere}
          onChange={(v) => setTweak("atmosphere", v)}
          options={[
            { value: "hive", label: "Hive" },
            { value: "waves", label: "Waves" },
            { value: "field", label: "Field" },
          ]}
        />
        <TweakToggle
          label="Side panel"
          value={tweaks.showStage}
          onChange={(v) => setTweak("showStage", v)}
        />
        <TweakToggle
          label="SSO before email/password"
          value={tweaks.ssoFirst}
          onChange={(v) => setTweak("ssoFirst", v)}
        />
        <TweakToggle
          label="Status pill in header"
          value={tweaks.showStatusBadge}
          onChange={(v) => setTweak("showStatusBadge", v)}
        />
      </TweakSection>

      <TweakSection title="Copy">
        <TweakSelect
          label="Side panel headline"
          value={tweaks.headlineKey}
          onChange={(v) => setTweak("headlineKey", v)}
          options={[
            { value: "rhythm", label: "1. Rhythm (current)" },
            { value: "scale", label: "2. Human + AI scale" },
            { value: "manifesto", label: "3. Manifesto" },
            { value: "product", label: "4. Product first" },
            { value: "outcome", label: "5. Outcome focused" },
            { value: "welcome", label: "6. Invitation" },
          ]}
        />
        <TweakText
          label="Form headline"
          value={tweaks.headlineCopy}
          onChange={(v) => setTweak("headlineCopy", v)}
        />
      </TweakSection>
    </TweaksPanel>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
