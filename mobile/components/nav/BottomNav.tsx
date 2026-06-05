"use client";

import { Building2, ClipboardCheck, LayoutDashboard, ListChecks, MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/command", key: "command", Icon: MessageSquare },
  { href: "/approvals", key: "approvals", Icon: ClipboardCheck },
  { href: "/tasks", key: "tasks", Icon: ListChecks },
  { href: "/departments", key: "team", Icon: Building2 },
  { href: "/dashboard", key: "dashboard", Icon: LayoutDashboard },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations("mobile.nav");

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg-panel/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md">
        {TABS.map(({ href, key, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={key} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors ${
                  active ? "text-accent" : "text-fg-subtle hover:text-fg-muted"
                }`}
              >
                {active && (
                  <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-accent" />
                )}
                <Icon size={22} strokeWidth={active ? 2.4 : 1.8} />
                <span>{t(key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
