"use client";

import {
  Building2,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { PushToggle } from "@/components/push/PushToggle";
import { useUnreadReports } from "@/components/reports/useUnreadReports";
import { Sheet } from "@/components/ui/Sheet";

const TABS = [
  { href: "/command", key: "command", Icon: MessageSquare },
  { href: "/approvals", key: "approvals", Icon: ClipboardCheck },
  { href: "/tasks", key: "tasks", Icon: ListChecks },
  { href: "/departments", key: "team", Icon: Building2 },
] as const;

// Itens dentro do menu "Mais".
const MORE = [
  { href: "/reports", key: "reports", Icon: FileText, badge: true },
  { href: "/dashboard", key: "dashboard", Icon: LayoutDashboard, badge: false },
] as const;

function Badge({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="absolute -right-2 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
      {n > 99 ? "99+" : n}
    </span>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations("mobile.nav");
  const [moreOpen, setMoreOpen] = useState(false);
  const unread = useUnreadReports();

  const moreActive = MORE.some((m) => pathname.startsWith(m.href));

  return (
    <>
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

          <li className="flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={`relative flex w-full flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors ${
                moreActive ? "text-accent" : "text-fg-subtle hover:text-fg-muted"
              }`}
            >
              {moreActive && (
                <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-accent" />
              )}
              <span className="relative">
                <MoreHorizontal size={22} strokeWidth={moreActive ? 2.4 : 1.8} />
                <Badge n={unread} />
              </span>
              <span>{t("more")}</span>
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title={t("more")}>
        <div className="flex flex-col gap-1">
          {MORE.map(({ href, key, Icon, badge }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={key}
                href={href}
                onClick={() => setMoreOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-3 ${
                  active ? "bg-bg-subtle text-fg" : "text-fg-muted hover:bg-bg-subtle"
                }`}
              >
                <MoreItemIcon Icon={Icon} />
                <span className="flex-1 font-medium">{t(key)}</span>
                {badge && unread > 0 && (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[11px] font-bold text-white">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
            );
          })}
          <div className="my-1 border-t border-border" />
          <PushToggle />
        </div>
      </Sheet>
    </>
  );
}

function MoreItemIcon({ Icon }: { Icon: LucideIcon }) {
  return <Icon size={20} className="text-fg-subtle" />;
}
