"use client";

import { Activity, Bot, ClipboardList, Inbox, LayoutDashboard, LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agents", label: "Agentes", icon: Bot },
  { href: "/tasks", label: "Tarefas", icon: ClipboardList },
  { href: "/approvals", label: "Aprovações", icon: Inbox },
  { href: "/audit", label: "Auditoria", icon: Activity },
];

export function Sidebar({ userName, role }: { userName: string; role: string }) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 flex-col bg-bg-subtle border-r border-border h-screen sticky top-0">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
        <div className="size-9 rounded-lg bg-accent grid place-items-center text-white font-display font-bold text-sm">
          IF
        </div>
        <div>
          <div className="font-display font-semibold leading-tight">IntelliForce</div>
          <div className="text-xs text-fg-muted">v0.1.0</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                active
                  ? "bg-accent-soft text-accent font-medium"
                  : "text-fg-muted hover:bg-bg-panel hover:text-fg"
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3 space-y-2">
        <div className="px-3 py-2 flex items-center gap-3">
          <div className="size-8 rounded-full bg-accent-soft text-accent grid place-items-center text-xs font-semibold">
            {userName.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{userName}</div>
            <div className="text-xs text-fg-muted flex items-center gap-1">
              <ShieldCheck className="size-3" />
              {role}
            </div>
          </div>
        </div>
        <Link href="/logout" className="btn-ghost w-full justify-start text-fg-muted">
          <LogOut className="size-4" />
          Sair
        </Link>
      </div>
    </aside>
  );
}
