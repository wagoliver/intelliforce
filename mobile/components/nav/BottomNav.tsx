"use client";

import { ClipboardCheck, LayoutDashboard, ListChecks, MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", key: "dashboard", Icon: LayoutDashboard },
  { href: "/approvals", key: "approvals", Icon: ClipboardCheck },
  { href: "/tasks", key: "tasks", Icon: ListChecks },
  { href: "/command", key: "command", Icon: MessageSquare },
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
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                  active ? "text-accent" : "text-fg-subtle hover:text-fg-muted"
                }`}
              >
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
