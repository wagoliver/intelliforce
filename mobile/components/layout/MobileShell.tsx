"use client";

import { LogOut } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { BottomNav } from "@/components/nav/BottomNav";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export function MobileShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      <div className="app-mesh" aria-hidden="true" />
      <div className="relative z-10 flex min-h-[100dvh] flex-col">
        <header
          className="fixed inset-x-0 top-0 z-20 flex items-center justify-between border-b border-border bg-bg/80 px-4 backdrop-blur"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="flex h-14 items-center gap-2">
            <span className="text-gradient font-display text-base font-semibold tracking-tight">
              IntelliForce
            </span>
          </div>
          <div className="-mr-2 flex items-center gap-0.5">
            <ThemeToggle />
            <a
              href="/logout"
              aria-label="Sair"
              className="grid h-10 w-10 place-items-center rounded-lg text-fg-subtle hover:bg-bg-subtle hover:text-fg"
            >
              <LogOut size={18} />
            </a>
          </div>
        </header>

        <main
          className="flex-1 px-4"
          style={{
            // compensa o header fixo (safe-area + 56px) + respiro
            paddingTop: "calc(env(safe-area-inset-top) + 72px)",
            paddingBottom: "calc(env(safe-area-inset-bottom) + 76px)",
          }}
        >
          <div key={pathname} className="page-enter">
            {children}
          </div>
        </main>

        <BottomNav />
      </div>
    </>
  );
}
