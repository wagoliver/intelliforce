"use client";

import { useEffect, type ReactNode } from "react";

/** Bottom sheet (drawer de baixo) — usado p/ ações como "rejeitar com motivo". */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div
        className="relative w-full rounded-t-2xl border-t border-border bg-bg-panel p-5 shadow-elevated animate-[sheet-up_180ms_ease-out]"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
        {title && <h2 className="mb-3 font-display text-lg font-semibold text-fg">{title}</h2>}
        {children}
      </div>
    </div>
  );
}
