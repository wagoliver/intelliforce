"use client";

import { useEffect, useState } from "react";

import { reports } from "@/lib/api/reports";

export const REPORTS_LAST_SEEN = "reports_last_seen";

/** Conta relatórios criados depois do último "visto" (localStorage). */
export function useUnreadReports(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const list = await reports.list();
        if (cancelled) return;
        const lastSeen = Number(localStorage.getItem(REPORTS_LAST_SEEN) || 0);
        setCount(list.filter((r) => new Date(r.created_at).getTime() > lastSeen).length);
      } catch {
        /* silencioso */
      }
    }

    void check();
    const t = setInterval(() => void check(), 45_000);
    const onSeen = () => void check();
    window.addEventListener("reports:seen", onSeen);
    window.addEventListener("focus", onSeen);
    return () => {
      cancelled = true;
      clearInterval(t);
      window.removeEventListener("reports:seen", onSeen);
      window.removeEventListener("focus", onSeen);
    };
  }, []);

  return count;
}

/** Marca tudo como visto agora e avisa o badge. */
export function markReportsSeen() {
  try {
    localStorage.setItem(REPORTS_LAST_SEEN, String(Date.now()));
    window.dispatchEvent(new Event("reports:seen"));
  } catch {
    /* ignore */
  }
}
