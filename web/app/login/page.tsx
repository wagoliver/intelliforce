"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { loginAction, registerAction } from "./actions";
import "./login.css";

type Step = "login" | "register" | "forgot" | "forgot-sent";

export default function LoginPage() {
  const [step, setStep] = useState<Step>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [emailErr, setEmailErr] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.variant = "institutional";
  }, []);

  function validateLogin() {
    let ok = true;
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setEmailErr("Informe um e-mail válido."); ok = false;
    } else setEmailErr("");
    if (!password || password.length < 6) {
      setPwErr("Senha precisa de pelo menos 6 caracteres."); ok = false;
    } else setPwErr("");
    return ok;
  }

  async function submitLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateLogin()) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("email", email);
      fd.append("password", password);
      const result = await loginAction(fd);
      if (result?.error) setError(result.error);
    } catch {
      // redirect lança NEXT_REDIRECT — esperado
    } finally {
      setLoading(false);
    }
  }

  async function submitRegister(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name || !email || password.length < 8) {
      setError("Preencha nome, email válido e senha (8+ caracteres).");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("name", name);
      fd.append("email", email);
      fd.append("password", password);
      const result = await registerAction(fd);
      if (result?.error) setError(result.error);
    } catch {
      // redirect lança NEXT_REDIRECT
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page" data-variant="institutional">
      <div className="form-col">
        <BrandRow />

        <div className="form-wrap">
          <div className="form-card">
            {step === "login" && (
              <LoginForm
                email={email} setEmail={setEmail}
                password={password} setPassword={setPassword}
                showPw={showPw} setShowPw={setShowPw}
                remember={remember} setRemember={setRemember}
                emailErr={emailErr} pwErr={pwErr}
                error={error} loading={loading}
                onSubmit={submitLogin}
                onForgot={() => setStep("forgot")}
                onRegister={() => { setStep("register"); setError(null); }}
              />
            )}
            {step === "register" && (
              <RegisterForm
                name={name} setName={setName}
                email={email} setEmail={setEmail}
                password={password} setPassword={setPassword}
                showPw={showPw} setShowPw={setShowPw}
                error={error} loading={loading}
                onSubmit={submitRegister}
                onBack={() => { setStep("login"); setError(null); }}
              />
            )}
            {step === "forgot" && (
              <ForgotForm
                email={email} setEmail={setEmail}
                onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); setStep("forgot-sent"); }}
                onBack={() => setStep("login")}
              />
            )}
            {step === "forgot-sent" && (
              <ForgotSent email={email} onBack={() => setStep("login")} />
            )}
          </div>
        </div>

        <FootBar />
      </div>

      <div className="stage-col">
        <StageInstitutional />
      </div>
    </div>
  );
}

// ============================================================================
// BrandRow
// ============================================================================
function BrandRow() {
  return (
    <div className="brand-row">
      <div className="brand-mark">
        <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-label="IntelliForce">
          <path d="M10 10 H54 V54 H10 Z M22 22 V42 H42 V22 Z" fill="currentColor" fillRule="evenodd" />
        </svg>
      </div>
      <div className="brand-name">
        IntelliForce
        <span className="pill">Workforce&nbsp;OS</span>
      </div>
    </div>
  );
}

// ============================================================================
// Icons
// ============================================================================
const Mail = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
);
const Lock = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);
const User = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const Eye = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const EyeOff = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M9.88 5.16A10.94 10.94 0 0 1 12 5c6.5 0 10 7 10 7a17.64 17.64 0 0 1-3.06 3.94" />
    <path d="M6.61 6.61A17.91 17.91 0 0 0 2 12s3.5 7 10 7a10.94 10.94 0 0 0 5.39-1.39" />
    <path d="m2 2 20 20" />
    <path d="M9.5 9.5a3 3 0 0 0 4.24 4.24" />
  </svg>
);
const Arrow = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M5 12h14" />
    <path d="m13 6 6 6-6 6" />
  </svg>
);
const Check = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M5 12l4 4 10-10" />
  </svg>
);
const Back = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M19 12H5" />
    <path d="m11 18-6-6 6-6" />
  </svg>
);
const Shield = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

// ============================================================================
// LoginForm
// ============================================================================
function LoginForm(props: {
  email: string; setEmail: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  showPw: boolean; setShowPw: (v: boolean) => void;
  remember: boolean; setRemember: (v: boolean) => void;
  emailErr: string; pwErr: string;
  error: string | null; loading: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onForgot: () => void;
  onRegister: () => void;
}) {
  const { email, setEmail, password, setPassword, showPw, setShowPw, remember, setRemember,
          emailErr, pwErr, error, loading, onSubmit, onForgot, onRegister } = props;

  return (
    <>
      <div className="form-eyebrow">Acesso seguro</div>
      <h1 className="form-title">Entre no seu workforce digital.</h1>
      <p className="form-sub">
        Orquestre seus agentes, automações e times humanos a partir de um único painel.
      </p>

      <form onSubmit={onSubmit} noValidate>
        <div className="field">
          <div className="field-label"><span>E-mail corporativo</span></div>
          <div className="input-wrap">
            <Mail className="leading-icon" />
            <input
              className={`input ${emailErr ? "error" : ""}`}
              type="email"
              placeholder="voce@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
            />
          </div>
          {emailErr && <div className="field-error">{emailErr}</div>}
        </div>

        <div className="field">
          <div className="field-label">
            <span>Senha</span>
            <a href="#" className="help" onClick={(e) => { e.preventDefault(); onForgot(); }}>Esqueci a senha</a>
          </div>
          <div className="input-wrap">
            <Lock className="leading-icon" />
            <input
              className={`input ${pwErr ? "error" : ""}`}
              type={showPw ? "text" : "password"}
              placeholder="••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button type="button" className="trailing-btn" onClick={() => setShowPw(!showPw)} aria-label="Mostrar senha">
              {showPw ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
            </button>
          </div>
          {pwErr && <div className="field-error">{pwErr}</div>}
        </div>

        <div className="row-between">
          <label className="checkbox">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <span className="box"><Check /></span>
            Mantenha-me conectado neste dispositivo
          </label>
        </div>

        {error && <div className="field-error" style={{ marginBottom: 12 }}>{error}</div>}

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? <><span className="spinner" /> Verificando…</> : <>Entrar <Arrow style={{ width: 16, height: 16 }} /></>}
        </button>
      </form>

      <div className="form-foot">
        <span>Novo no IntelliForce? <a href="#" onClick={(e) => { e.preventDefault(); onRegister(); }}>Criar conta</a></span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}>
          <Shield style={{ width: 14, height: 14 }} />
          ISO 27001 · SOC 2
        </span>
      </div>

      <div className="mobile-teaser">
        <span className="pulse" />
        <div>
          <strong style={{ color: "var(--text)" }}>Workforce digital</strong> rodando 24/7 sob seu controle.
        </div>
      </div>
    </>
  );
}

// ============================================================================
// RegisterForm
// ============================================================================
function RegisterForm(props: {
  name: string; setName: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  showPw: boolean; setShowPw: (v: boolean) => void;
  error: string | null; loading: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
}) {
  const { name, setName, email, setEmail, password, setPassword, showPw, setShowPw,
          error, loading, onSubmit, onBack } = props;

  return (
    <>
      <button className="btn-ghost" onClick={onBack} style={{ marginBottom: 18, marginLeft: -10 }}>
        <Back style={{ width: 14, height: 14 }} /> Voltar
      </button>
      <div className="form-eyebrow">Criar conta</div>
      <h1 className="form-title">Cadastre-se no IntelliForce</h1>
      <p className="form-sub">
        O primeiro usuário cadastrado vira admin automaticamente. Use seu e-mail corporativo.
      </p>

      <form onSubmit={onSubmit} noValidate>
        <div className="field">
          <div className="field-label"><span>Nome completo</span></div>
          <div className="input-wrap">
            <User className="leading-icon" />
            <input className="input" type="text" placeholder="Wagner Augusto"
              value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
        </div>
        <div className="field">
          <div className="field-label"><span>E-mail corporativo</span></div>
          <div className="input-wrap">
            <Mail className="leading-icon" />
            <input className="input" type="email" placeholder="voce@empresa.com"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <div className="field-label"><span>Senha (8+ caracteres)</span></div>
          <div className="input-wrap">
            <Lock className="leading-icon" />
            <input className="input" type={showPw ? "text" : "password"} placeholder="••••••••••"
              value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="trailing-btn" onClick={() => setShowPw(!showPw)}>
              {showPw ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
            </button>
          </div>
        </div>

        {error && <div className="field-error" style={{ marginBottom: 12 }}>{error}</div>}

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? <><span className="spinner" /> Criando…</> : <>Criar conta <Arrow style={{ width: 16, height: 16 }} /></>}
        </button>
      </form>
    </>
  );
}

// ============================================================================
// Forgot password (placeholder — backend não tem reset ainda)
// ============================================================================
function ForgotForm({ email, setEmail, onSubmit, onBack }: any) {
  return (
    <>
      <button className="btn-ghost" onClick={onBack} style={{ marginBottom: 18, marginLeft: -10 }}>
        <Back style={{ width: 14, height: 14 }} /> Voltar pra entrar
      </button>
      <div className="form-eyebrow">Recuperação</div>
      <h1 className="form-title">Redefinir sua senha</h1>
      <p className="form-sub">
        Em breve. Por enquanto, peça pro admin redefinir sua senha manualmente.
      </p>
      <form onSubmit={onSubmit}>
        <div className="field">
          <div className="field-label"><span>E-mail corporativo</span></div>
          <div className="input-wrap">
            <Mail className="leading-icon" />
            <input className="input" type="email" placeholder="voce@empresa.com"
              value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </div>
        </div>
        <button type="submit" className="btn-primary">
          Enviar link de recuperação <Arrow style={{ width: 16, height: 16 }} />
        </button>
      </form>
    </>
  );
}

function ForgotSent({ email, onBack }: any) {
  return (
    <>
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: "var(--accent-soft)", color: "var(--accent)",
        display: "grid", placeItems: "center", marginBottom: 18,
      }}>
        <Mail style={{ width: 22, height: 22 }} />
      </div>
      <h1 className="form-title">Verifique seu e-mail</h1>
      <p className="form-sub">
        Se uma conta estiver vinculada a <strong style={{ color: "var(--text)" }}>{email || "esse e-mail"}</strong>, um link foi enviado.
      </p>
      <button className="btn-primary" onClick={onBack}>Voltar pra entrar</button>
    </>
  );
}

// ============================================================================
// FootBar
// ============================================================================
function FootBar() {
  return (
    <div className="foot-bar">
      <span>© 2026 IntelliForce · Arctica</span>
      <nav>
        <a href="#">Privacidade</a>
        <a href="#">Termos</a>
        <a href="#">Status</a>
        <a href="#">Suporte</a>
      </nav>
    </div>
  );
}

// ============================================================================
// StageInstitutional (versão simplificada — sem canvas)
// ============================================================================
function StageInstitutional() {
  return (
    <div className="mesh-shift-bg" style={{
      position: "relative",
      width: "100%",
      height: "100%",
      padding: "48px",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      backgroundImage:
        "radial-gradient(circle at 20% 10%, color-mix(in oklab, var(--accent-green) 14%, transparent), transparent 50%), " +
        "radial-gradient(circle at 80% 90%, color-mix(in oklab, var(--accent-cyan) 12%, transparent), transparent 50%)",
      backgroundSize: "180% 180%, 180% 180%",
      overflow: "hidden",
    }}>
      <BgGrid />

      <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-subtle)",
          letterSpacing: "0.08em", textTransform: "uppercase",
        }}>
          Workforce&nbsp;OS · v0.1.0
        </span>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          fontSize: 12, color: "var(--text-muted)",
          padding: "6px 12px", borderRadius: 999,
          background: "var(--bg-elev)", border: "1px solid var(--border)",
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: 999,
            background: "var(--success)",
            boxShadow: "0 0 0 4px color-mix(in oklab, var(--success) 18%, transparent)",
          }} />
          Sistemas operacionais
        </span>
      </div>

      <div style={{ position: "relative", maxWidth: 540 }}>
        <p style={{
          fontFamily: "var(--font-display)",
          fontSize: 44,
          lineHeight: 1.15,
          letterSpacing: "-0.025em",
          fontWeight: 600,
          color: "var(--text)",
          margin: 0,
          textWrap: "balance" as any,
        }}>
          Sua{" "}
          <Hl>força de trabalho digital</Hl>
          ,<br />
          rodando{" "}
          <Hl>24/7</Hl>
          {" "}sem perder o ritmo.
        </p>
        <p style={{
          marginTop: 18,
          fontSize: 16,
          lineHeight: 1.5,
          color: "var(--text-muted)",
          maxWidth: 480,
        }}>
          Combine agentes de IA, automações e times humanos em um único painel inteligente,
          escalável e auditável.
        </p>
      </div>

      <div style={{ position: "relative" }}>
        <div style={{
          fontSize: 11, letterSpacing: "0.10em",
          textTransform: "uppercase", color: "var(--text-subtle)",
          marginBottom: 12,
        }}>
          Segurança enterprise
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["ISO 27001", "SOC 2 Type II", "LGPD", "GDPR"].map((c) => (
            <span key={c} style={{
              fontSize: 12, fontWeight: 500,
              padding: "4px 10px", borderRadius: 999,
              background: "var(--bg-elev)", color: "var(--text-muted)",
              border: "1px solid var(--border)",
            }}>
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Hl({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-gradient-accent" style={{
      whiteSpace: "nowrap",
      fontWeight: 700,
    }}>
      {children}
    </span>
  );
}

function BgGrid() {
  return (
    <div style={{
      position: "absolute",
      inset: 0,
      backgroundImage:
        "linear-gradient(to right, color-mix(in oklab, var(--text) 4%, transparent) 1px, transparent 1px), " +
        "linear-gradient(to bottom, color-mix(in oklab, var(--text) 4%, transparent) 1px, transparent 1px)",
      backgroundSize: "48px 48px",
      maskImage: "radial-gradient(ellipse at center, black 50%, transparent 100%)",
      WebkitMaskImage: "radial-gradient(ellipse at center, black 50%, transparent 100%)",
    }} />
  );
}
