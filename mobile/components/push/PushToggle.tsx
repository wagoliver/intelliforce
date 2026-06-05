"use client";

import { Bell, BellOff } from "lucide-react";
import { useEffect, useState } from "react";

import { enablePush, pushSupported } from "@/components/push/enablePush";

type State = "idle" | "on" | "denied" | "loading" | "error" | "unsupported";

/** Item do menu "Mais" pra ativar notificações de relatório (Web Push). */
export function PushToggle() {
  const [state, setState] = useState<State>("idle");

  useEffect(() => {
    if (!pushSupported()) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "granted") setState("on");
    else if (Notification.permission === "denied") setState("denied");
    else setState("idle");
  }, []);

  if (state === "unsupported") return null;

  async function onClick() {
    setState("loading");
    try {
      await enablePush();
      setState("on");
    } catch (e) {
      setState((e as Error).message === "denied" ? "denied" : "error");
    }
  }

  const label =
    state === "on"
      ? "Notificações ativadas"
      : state === "denied"
        ? "Notificações bloqueadas no sistema"
        : state === "loading"
          ? "Ativando…"
          : state === "error"
            ? "Falhou — tente de novo"
            : "Ativar notificações";

  const disabled = state === "on" || state === "denied" || state === "loading";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-3 rounded-lg px-3 py-3 text-left text-fg-muted hover:bg-bg-subtle disabled:opacity-60"
    >
      {state === "on" ? (
        <Bell size={20} className="text-accent" />
      ) : (
        <BellOff size={20} className="text-fg-subtle" />
      )}
      <span className="flex-1 font-medium">{label}</span>
    </button>
  );
}
