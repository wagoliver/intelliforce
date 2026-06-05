"use client";

import { Mic } from "lucide-react";

/** Botão push-to-talk: segura pra falar, solta pra enviar. */
export function MicButton({
  listening,
  disabled,
  onStart,
  onStop,
}: {
  listening: boolean;
  disabled?: boolean;
  onStart: () => void;
  onStop: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label="Segurar para falar"
      aria-pressed={listening}
      onPointerDown={(e) => {
        e.preventDefault();
        onStart();
      }}
      onPointerUp={(e) => {
        e.preventDefault();
        onStop();
      }}
      onPointerLeave={() => {
        if (listening) onStop();
      }}
      onContextMenu={(e) => e.preventDefault()}
      className={`grid h-10 w-10 shrink-0 touch-none select-none place-items-center rounded-lg transition-colors ${
        listening
          ? "animate-pulse bg-danger text-white"
          : "bg-bg-subtle text-fg-muted hover:text-fg disabled:opacity-50"
      }`}
    >
      <Mic size={18} />
    </button>
  );
}
