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
  agents: <g stroke="currentColor" strokeWidth="1.4" fill="none"><circle cx="8" cy="6" r="2.5"/><path d="M3 13.5c0-2.2 2.2-4 5-4s5 1.8 5 4"/></g>,
  proc: <g stroke="currentColor" strokeWidth="1.4" fill="none"><rect x="2.5" y="3" width="4" height="4" rx="0.5"/><rect x="9.5" y="3" width="4" height="4" rx="0.5"/><rect x="6" y="9" width="4" height="4" rx="0.5"/><path d="M4.5 7v1M11.5 7v1M6 11h-1.5v-3M10 11h1.5v-3"/></g>,
  queue: <g stroke="currentColor" strokeWidth="1.4" fill="none"><rect x="2.5" y="3" width="11" height="2.5" rx="0.5"/><rect x="2.5" y="6.75" width="11" height="2.5" rx="0.5"/><rect x="2.5" y="10.5" width="11" height="2.5" rx="0.5"/></g>,
  org: <g stroke="currentColor" strokeWidth="1.4" fill="none"><rect x="6" y="2.5" width="4" height="3" rx="0.5"/><rect x="2" y="10.5" width="4" height="3" rx="0.5"/><rect x="10" y="10.5" width="4" height="3" rx="0.5"/><path d="M8 5.5v2.5M4 10.5V8h8v2.5"/></g>,
  intg: <g stroke="currentColor" strokeWidth="1.4" fill="none"><path d="M5 3v3h-2v4h2v3M11 3v3h2v4h-2v3"/></g>,
  people: <g stroke="currentColor" strokeWidth="1.4" fill="none"><circle cx="6" cy="6" r="2"/><circle cx="11" cy="6" r="1.5"/><path d="M2.5 13c0-1.8 1.5-3.2 3.5-3.2s3.5 1.4 3.5 3.2M9.5 13c0-1.4 1-2.5 2-2.5s2 1.1 2 2.5"/></g>,
  insights: <g stroke="currentColor" strokeWidth="1.4" fill="none"><path d="M3 13V8M7 13V4M11 13V10"/></g>,
  set: <g stroke="currentColor" strokeWidth="1.4" fill="none"><circle cx="8" cy="8" r="2"/><path d="M8 1.5v1.5M8 13v1.5M14.5 8H13M3 8H1.5M12.5 3.5l-1 1M4.5 11.5l-1 1M12.5 12.5l-1-1M4.5 4.5l-1-1"/></g>,
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

type NavChild = { id: string; name: string; href: string };
type NavEntry = {
  id: string;
  name: string;
  icon: string;
  href: string;
  match?: string[];
  children?: NavChild[];
};

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  // Cada item declara: o `href` (target da navegação) + opcional `match` (lista de paths que ativam o item).
  const ops: NavEntry[] = [
    { id: "home", name: t("home"), icon: "home", href: "/dashboard", match: ["/dashboard"] },
    {
      id: "agents", name: t("agents"), icon: "agents", href: "/agents", match: ["/agents"],
      children: [
        { id: "skill",      name: t("agents_skill"),      href: "/agents/skill" },
        { id: "tools",      name: t("agents_tools"),      href: "/agents/tools" },
        { id: "knowledge",  name: t("agents_knowledge"),  href: "/agents/knowledge" },
        { id: "guardrails", name: t("agents_guardrails"), href: "/agents/guardrails" },
        { id: "triggers",   name: t("agents_triggers"),   href: "/agents/triggers" },
      ],
    },
    { id: "proc", name: t("processes"), icon: "proc", href: "/tasks", match: ["/tasks"] },
    { id: "queue", name: t("queue"), icon: "queue", href: "/approvals", match: ["/approvals"] },
  ];
  const config: NavEntry[] = [
    { id: "intg", name: t("integrations"), icon: "intg", href: "/audit", match: ["/audit"] },
    { id: "insights", name: t("insights"), icon: "insights", href: "/audit", match: [] },
    { id: "set", name: t("settings"), icon: "set", href: "/setup", match: ["/setup"] },
  ];

  function renderEntry(i: NavEntry) {
    const active = isActive(pathname, i.href, i.match ?? []);
    const showChildren = !collapsed && active && i.children && i.children.length > 0;
    return (
      <div key={i.id} className="sb-group">
        <NavItem name={i.name} icon={i.icon} href={i.href} collapsed={collapsed} active={active} />
        {showChildren && (
          <div className="sb-subnav">
            {i.children!.map((c) => (
              <Link
                key={c.id}
                href={c.href}
                className={`sb-subitem ${pathname === c.href ? "active" : ""}`}
              >
                {c.name}
              </Link>
            ))}
          </div>
        )}
      </div>
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
        {!collapsed && <div className="sb-section-label">Configure</div>}
        {collapsed && <div className="sb-divider" />}
        {config.map(renderEntry)}
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

function TopBar() {
  const tc = useTranslations("common");
  const tn = useTranslations("nav");
  return (
    <div className="topbar">
      <div className="tb-search">
        <SvgIcon className="ico" name="search" />
        <span>{tc("search_placeholder")}</span>
        <kbd>⌘ K</kbd>
      </div>
      <div className="tb-actions">
        <button className="tb-iconbtn" title={tn("toggle_theme")}>
          <SvgIcon className="ico" name="theme" />
        </button>
        <button className="tb-iconbtn" title={tn("notifications")}>
          <SvgIcon className="ico" name="bell" />
          <span className="tb-iconbtn-dot" />
        </button>
        <div className="tb-divider" />
        <UserMenu userName={data.user.name} userOrg={data.user.org} userRole={data.user.role} />
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  // Agent IDE wants the whole viewport — escape the centered canvas constraints
  const isFullscreen = !!pathname?.startsWith("/agents");
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
