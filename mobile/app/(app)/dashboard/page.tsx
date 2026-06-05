"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { HealthRadar, deriveHealthLevel } from "@/components/health/HealthRadar";
import {
  diagnostics,
  formatRelativeAge,
  type ComponentStatus,
  type DiagnosticsStatus,
} from "@/lib/api/diagnostics";

const STATUS_COLOR: Record<ComponentStatus, string> = {
  ok: "#22c55e",
  warn: "#eab308",
  err: "#ef4444",
  unknown: "#a1a1aa",
};

export default function DashboardPage() {
  const [status, setStatus] = useState<DiagnosticsStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setStatus(await diagnostics.status());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  if (!status && !error) {
    return <p className="py-10 text-center text-sm text-fg-muted">Carregando…</p>;
  }

  const s = status?.summary;
  const level = s ? deriveHealthLevel(s) : "warn";
  const heroText = !s
    ? "Sem dados"
    : level === "ok"
      ? "Todos os serviços saudáveis"
      : level === "err"
        ? `${s.error} ${s.error === 1 ? "serviço" : "serviços"} com erro`
        : `${s.warning + s.unknown} precisam de atenção`;

  return (
    <div className="flex flex-col gap-4">
      <ScreenHeader eyebrow="Sistema" title="Saúde" />
      {error && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      {/* Hero de saúde */}
      <div className="panel card-glow mesh-hero flex items-center gap-4 p-5">
        <HealthRadar level={level} size={20} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-semibold text-fg">{heroText}</p>
          {status && (
            <p className="text-xs text-fg-subtle">
              Verificado {formatRelativeAge(status.last_check)}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={load}
          disabled={busy}
          aria-label="Testar tudo"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-fg-subtle hover:bg-bg-subtle hover:text-fg"
        >
          <RefreshCw size={18} className={busy ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Contadores */}
      {s && (
        <div className="stagger grid grid-cols-4 gap-2">
          <Counter label="Saudáveis" value={s.healthy} color={STATUS_COLOR.ok} />
          <Counter label="Atenção" value={s.warning} color={STATUS_COLOR.warn} />
          <Counter label="Erro" value={s.error} color={STATUS_COLOR.err} />
          <Counter label="—" value={s.unknown} color={STATUS_COLOR.unknown} />
        </div>
      )}

      {/* Lista de componentes */}
      {status && (
        <div className="panel stagger divide-y divide-border">
          {status.components.map((c) => (
            <div key={c.id} className="flex items-center gap-3 p-3.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: STATUS_COLOR[c.status] }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-fg">{c.name}</p>
                <p className="truncate text-xs text-fg-subtle">
                  {c.message || c.description}
                </p>
              </div>
              {c.metric && (
                <span className="shrink-0 font-mono text-xs text-fg-muted">
                  {c.metric.value}
                  {c.metric.suffix ?? ""}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Counter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="panel flex flex-col items-center gap-0.5 py-3">
      <span className="font-display text-lg font-semibold" style={{ color }}>
        {value}
      </span>
      <span className="text-[10px] uppercase tracking-wide text-fg-subtle">{label}</span>
    </div>
  );
}
