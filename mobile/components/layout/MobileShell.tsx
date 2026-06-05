"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { BottomNav } from "@/components/nav/BottomNav";

/** Mapeia o pathname → chave de título em mobile.nav. */
function titleKeyFor(pathname: string): string | null {
  if (pathname.startsWith("/dashboard")) return "dashboard";
  if (pathname.startsWith("/approvals")) return "approvals";
  if (pathname.startsWith("/tasks")) return "tasks";
  if (pathname.startsWith("/command")) return "command";
  return null;
}

export function MobileShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations("mobile.nav");
  const key = titleKeyFor(pathname ?? "");

  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg">
      <header
        className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-bg/80 px-4 backdrop-blur"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex h-14 items-center gap-2">
          <span className="font-display text-base font-semibold text-fg">
            {key ? t(key) : "IntelliForce"}
          </span>
        </div>
        <a
          href="/logout"
          aria-label="Sair"
          className="-mr-2 grid h-10 w-10 place-items-center rounded-lg text-fg-subtle hover:bg-bg-subtle hover:text-fg"
        >
          <LogOut size={18} />
        </a>
      </header>

      <main
        className="flex-1 px-4 py-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 76px)" }}
      >
        {children}
      </main>

      <BottomNav />
    </div>
  );
}
