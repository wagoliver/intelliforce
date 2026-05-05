"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";

import "./user-menu.css";

export interface UserMenuProps {
  userName: string;
  userOrg?: string;
  userRole?: string;
}

const LOCALES = [
  { code: "pt-BR", label: "Português (Brasil)", short: "PT" },
  { code: "en", label: "English", short: "EN" },
];

const APP_VERSION = "0.1.0";

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
const LogoutIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </svg>
);
const InfoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8h.01M11 12h1v4h1" />
  </svg>
);
const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12l4 4 10-10" />
  </svg>
);

const THEMES = [
  { code: "light" as const, Icon: SunIcon },
  { code: "dark" as const, Icon: MoonIcon },
];

function getCurrentTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  const cookie = document.cookie.split("; ").find((c) => c.startsWith("if_theme="));
  return cookie?.split("=")[1] === "dark" ? "dark" : "light";
}

type AuthMe = {
  email?: string;
  name?: string;
  role?: string;
  id?: string;
};

/**
 * UserMenu — avatar + dropdown com preferências e info da conta.
 *
 * Estrutura:
 *   - Header (avatar + nome + email + role)
 *   - Theme picker (segmented control light/dark)
 *   - Language picker (PT-BR / EN)
 *   - Footer (versão app + about + logout)
 */
export function UserMenu({ userName, userOrg, userRole }: UserMenuProps) {
  const t = useTranslations("nav");
  const tLang = useTranslations("language");
  const tTheme = useTranslations("theme");
  const currentLocale = useLocale();
  const [currentTheme, setCurrentTheme] = useState<"light" | "dark">("light");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [me, setMe] = useState<AuthMe | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentTheme(getCurrentTheme());
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Busca /auth/me só quando abrir pra ter email/role real (mock vem por prop)
  useEffect(() => {
    if (!open || me) return;
    fetch("/api/proxy/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setMe(data);
      })
      .catch(() => {
        /* fallback silencioso pros props */
      });
  }, [open, me]);

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
      document.documentElement.dataset.theme = theme;
      document.documentElement.classList.toggle("dark", theme === "dark");
      setCurrentTheme(theme);
    });
  }

  const displayName = me?.name ?? userName;
  const displayEmail = me?.email;
  const displayRole = me?.role ?? userRole;
  const initial = (displayName || "?")[0]?.toUpperCase();

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="tb-account"
        style={{ position: "relative" }}
      >
        <div className="tb-avatar">{initial}</div>
        <div className="tb-account-text">
          <div className="tb-account-name">{displayName}</div>
          {userOrg && <div className="tb-account-org">{userOrg}</div>}
        </div>
        <svg className="ico tb-account-chev" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
          <path d="M5 7l3 3 3-3" stroke="currentColor" strokeWidth="1.4" fill="none" />
        </svg>
      </button>

      {open && (
        <div className="um-dropdown">
          {/* Header — identidade */}
          <div className="um-header">
            <div className="um-avatar">{initial}</div>
            <div className="um-identity">
              <div className="um-name">{displayName}</div>
              {displayEmail && <div className="um-email">{displayEmail}</div>}
              {displayRole && <span className="um-role">{displayRole}</span>}
            </div>
          </div>

          {/* Theme */}
          <div className="um-section-label">{tTheme("label")}</div>
          <div className="um-theme-row">
            {THEMES.map((th) => {
              const active = th.code === currentTheme;
              return (
                <button
                  key={th.code}
                  onClick={() => changeTheme(th.code)}
                  disabled={pending}
                  data-active={active}
                  className="um-theme-btn"
                >
                  <th.Icon />
                  <span>{tTheme(th.code)}</span>
                </button>
              );
            })}
          </div>

          {/* Language */}
          <div className="um-section-label">{tLang("label")}</div>
          {LOCALES.map((l) => {
            const active = l.code === currentLocale;
            return (
              <button
                key={l.code}
                onClick={() => changeLocale(l.code)}
                disabled={pending}
                data-active={active}
                className="um-item"
              >
                <span className="um-item-locale-tag">{l.short}</span>
                <span className="um-item-label">{l.label}</span>
                {active && (
                  <span className="um-item-check">
                    <CheckIcon />
                  </span>
                )}
              </button>
            );
          })}

          <div className="um-divider" />

          {/* Meta — versão + about (placeholder) */}
          <div className="um-meta">
            <span className="um-meta-version">IntelliForce {APP_VERSION}</span>
            <a
              href="https://github.com/wagner-arctica/IntelliForce"
              target="_blank"
              rel="noopener noreferrer"
              className="um-meta-link"
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <InfoIcon />
                <span>Sobre</span>
              </span>
            </a>
          </div>

          {/* Logout */}
          <a href="/logout" className="um-logout">
            <LogoutIcon />
            <span>{t("logout")}</span>
          </a>
        </div>
      )}
    </div>
  );
}
