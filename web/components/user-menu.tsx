"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";

export interface UserMenuProps {
  userName: string;
  userOrg?: string;
  userRole?: string;
}

const LOCALES = [
  { code: "pt-BR", label: "Português (Brasil)", short: "PT" },
  { code: "en", label: "English", short: "EN" },
];

const SunIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);
const MoonIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const THEMES = [
  { code: "light", Icon: SunIcon },
  { code: "dark", Icon: MoonIcon },
];

function getCurrentTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  const cookie = document.cookie.split("; ").find((c) => c.startsWith("if_theme="));
  return cookie?.split("=")[1] === "dark" ? "dark" : "light";
}

/**
 * UserMenu — avatar + dropdown com preferências do usuário (idioma, logout).
 *
 * Renderiza como botão no header. Visualmente combina com TopBar do home-v2.
 */
export function UserMenu({ userName, userOrg, userRole }: UserMenuProps) {
  const t = useTranslations("nav");
  const tLang = useTranslations("language");
  const tTheme = useTranslations("theme");
  const currentLocale = useLocale();
  const [currentTheme, setCurrentTheme] = useState<"light" | "dark">("light");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentTheme(getCurrentTheme());
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function changeLocale(locale: string) {
    if (locale === currentLocale) return;
    startTransition(async () => {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      window.location.reload();
    });
  }

  function changeTheme(theme: "light" | "dark") {
    if (theme === currentTheme) return;
    startTransition(async () => {
      await fetch("/api/theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme }),
      });
      // Aplica imediatamente no <html> sem precisar de reload
      document.documentElement.dataset.theme = theme;
      document.documentElement.classList.toggle("dark", theme === "dark");
      setCurrentTheme(theme);
    });
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="tb-account"
        style={{ position: "relative" }}
      >
        <div className="tb-avatar">{(userName || "?")[0]?.toUpperCase()}</div>
        <div className="tb-account-text">
          <div className="tb-account-name">{userName}</div>
          {userOrg && <div className="tb-account-org">{userOrg}</div>}
        </div>
        <svg className="ico tb-account-chev" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
          <path d="M5 7l3 3 3-3" stroke="currentColor" strokeWidth="1.4" fill="none" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            background: "var(--bg-elev)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow)",
            minWidth: 240,
            zIndex: 1000,
            padding: 6,
          }}
        >
          {/* Cabeçalho com info do usuário */}
          <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{userName}</div>
            {userRole && (
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                {userRole}
              </div>
            )}
          </div>

          {/* Tema */}
          <div style={{ padding: "8px 12px 4px", fontSize: 11, color: "var(--text-subtle)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>
            {tTheme("label")}
          </div>
          <div style={{ display: "flex", gap: 4, padding: "0 6px 6px" }}>
            {THEMES.map((th) => {
              const active = th.code === currentTheme;
              return (
                <button
                  key={th.code}
                  onClick={() => changeTheme(th.code as "light" | "dark")}
                  disabled={pending}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "8px 10px",
                    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                    background: active ? "var(--accent-soft)" : "transparent",
                    color: active ? "var(--accent)" : "var(--text-muted)",
                    cursor: pending ? "wait" : "pointer",
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: active ? 600 : 500,
                  }}
                >
                  <th.Icon />
                  <span>{tTheme(th.code as any)}</span>
                </button>
              );
            })}
          </div>

          {/* Idioma */}
          <div style={{ padding: "8px 12px 4px", fontSize: 11, color: "var(--text-subtle)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>
            {tLang("label")}
          </div>
          {LOCALES.map((l) => {
            const active = l.code === currentLocale;
            return (
              <button
                key={l.code}
                onClick={() => changeLocale(l.code)}
                disabled={pending}
                style={{
                  display: "flex",
                  width: "100%",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 12px",
                  border: 0,
                  background: active ? "var(--accent-soft)" : "transparent",
                  color: active ? "var(--accent)" : "var(--text)",
                  cursor: pending ? "wait" : "pointer",
                  borderRadius: 6,
                  fontSize: 13,
                  textAlign: "left",
                  fontWeight: active ? 600 : 400,
                }}
              >
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
                  padding: "2px 6px", borderRadius: 4,
                  border: "1px solid var(--border)", color: "var(--text-muted)",
                  minWidth: 28, textAlign: "center",
                }}>{l.short}</span>
                <span style={{ flex: 1 }}>{l.label}</span>
                {active && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12l4 4 10-10" />
                  </svg>
                )}
              </button>
            );
          })}

          <div style={{ borderTop: "1px solid var(--border)", marginTop: 4, paddingTop: 4 }}>
            <a
              href="/logout"
              style={{
                display: "block",
                padding: "8px 12px",
                color: "var(--danger)",
                textDecoration: "none",
                fontSize: 13,
                borderRadius: 6,
              }}
            >
              {t("logout")}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
