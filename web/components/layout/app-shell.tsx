"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { UserMenu } from "@/components/user-menu";

import "./app-shell.css";

// User mock — futuro: vem do contexto auth
const data = {
  user: { name: "Wagner", role: "Operations builder", org: "Arctica" },
};

const BrandMark = () => (
  <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 10 H54 V54 H10 Z M22 22 V42 H42 V22 Z" fill="currentColor" fillRule="evenodd" />
  </svg>
);

const Ico: any = {
  home: <path d="M3 9.5l5-5 5 5V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round"/>,
  skills: <path d="M8 2.5l5 2.5v3c0 3-2 5.5-5 6.5-3-1-5-3.5-5-6.5V5l5-2.5z" stroke="currentColor" strokeWidth="1.4" fill="none"/>,
  vault: <g stroke="currentColor" strokeWidth="1.4" fill="none"><path d="M5 7V5.5a3 3 0 0 1 6 0V7"/><rect x="3.5" y="7" width="9" height="6" rx="1"/><circle cx="8" cy="10" r="0.9" fill="currentColor" stroke="none"/></g>,
  search: <g stroke="currentColor" strokeWidth="1.4" fill="none"><circle cx="6.5" cy="6.5" r="3.5"/><path d="M9 9l3 3"/></g>,
  bell: <g stroke="currentColor" strokeWidth="1.4" fill="none"><path d="M4 11V7a4 4 0 0 1 8 0v4l1 1H3l1-1zM7 13h2"/></g>,
  theme: <g stroke="currentColor" strokeWidth="1.4" fill="none"><path d="M11 8.5A4 4 0 0 1 7.5 4 a4 4 0 1 0 3.5 4.5z"/></g>,
  menuLeft: <path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
  menuRight: <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
};

const SvgIcon = ({ name, ...rest }: any) => (
  <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" {...rest}>{Ico[name]}</svg>
);

function isActive(pathname: string | null, href: string, prefixes: string[] = []) {
  if (!pathname) return false;
  if (pathname === href) return true;
  if (prefixes.some((p) => pathname.startsWith(p))) return true;
  return false;
}

type NavEntry = {
  id: string;
  name: string;
  icon: string;
  href: string;
  match?: string[];
};

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const ops: NavEntry[] = [
    { id: "home", name: t("home"), icon: "home", href: "/dashboard", match: ["/dashboard"] },
    { id: "skills", name: t("skills"), icon: "skills", href: "/skills", match: ["/skills"] },
    { id: "vault", name: t("vault"), icon: "vault", href: "/vault", match: ["/vault"] },
  ];

  function renderEntry(i: NavEntry) {
    const active = isActive(pathname, i.href, i.match ?? []);
    return (
      <NavItem
        key={i.id}
        name={i.name}
        icon={i.icon}
        href={i.href}
        collapsed={collapsed}
        active={active}
      />
    );
  }

  return (
    <aside className={`sidebar ${collapsed ? "is-collapsed" : ""}`}>
      <div className="sb-brand">
        <div className="sb-brand-mark"><BrandMark /></div>
        {!collapsed && <div className="sb-brand-name">IntelliForce</div>}
        <button className="sb-toggle" onClick={onToggle} title={collapsed ? "Expand menu" : "Collapse menu"}>
          <SvgIcon className="ico" name={collapsed ? "menuRight" : "menuLeft"} />
        </button>
      </div>
      {!collapsed && <div className="sb-org">{data.user.org}</div>}

      <nav className="sb-nav">
        {ops.map(renderEntry)}
      </nav>
    </aside>
  );
}

function NavItem({
  name, icon, active, collapsed, href,
}: { name: string; icon: string; active?: boolean; collapsed: boolean; href: string; }) {
  return (
    <Link href={href} className={`sb-item ${active ? "active" : ""}`} title={collapsed ? name : undefined}>
      <SvgIcon className="ico" name={icon} />
      {!collapsed && <span>{name}</span>}
    </Link>
  );
}

function FullscreenButton() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function update() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  function toggle() {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen();
    }
  }

  return (
    <button
      type="button"
      className="tb-iconbtn"
      onClick={toggle}
      title={isFullscreen ? "Sair de tela cheia" : "Tela cheia"}
      aria-label={isFullscreen ? "Sair de tela cheia" : "Tela cheia"}
    >
      <svg width={16} height={16} viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
        {isFullscreen ? (
          /* Exit fullscreen — 4 cantos convergindo pro centro */
          <path
            d="M6 3v3H3M13 6h-3V3M10 13v-3h3M3 10h3v3"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          /* Enter fullscreen — 4 cantos divergindo */
          <path
            d="M3 6V3h3M10 3h3v3M13 10v3h-3M6 13H3v-3"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </button>
  );
}

function TopBar() {
  const tc = useTranslations("common");
  return (
    <div className="topbar">
      <div className="tb-search">
        <SvgIcon className="ico" name="search" />
        <span>{tc("search_placeholder")}</span>
        <kbd>⌘ K</kbd>
      </div>
      <div className="tb-actions">
        <FullscreenButton />
        <div className="tb-divider" />
        <UserMenu userName={data.user.name} userOrg={data.user.org} userRole={data.user.role} />
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  // /skills é uma "tela criativa" — usa o viewport inteiro, escapa do canvas centrado
  const isFullscreen = !!pathname?.startsWith("/skills");
  return (
    <div className={`app ${collapsed ? "sidebar-collapsed" : ""}`}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <main>
        <TopBar />
        <div className={`canvas ${isFullscreen ? "canvas-full" : ""}`}>{children}</div>
      </main>
    </div>
  );
}
