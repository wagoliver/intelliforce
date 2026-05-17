"use client";

import { useCallback, useEffect, useState } from "react";

import { ApiError, apiFetch } from "@/lib/api/client";

type Status = "ok" | "warn" | "error";

type CheckResult = {
  name: string;
  status: Status;
  summary: string;
  details: Record<string, unknown>;
  recommendation: string | null;
};

type DiagnosticsReport = {
  generated_at: number;
  checks: CheckResult[];
};

const CHECK_LABEL: Record<string, string> = {
  lm_studio: "LM Studio",
  opencode: "OpenCode / System Prompt",
  admins: "Admins humanos",
};

const STATUS_LABEL: Record<Status, string> = {
  ok: "OK",
  warn: "Atenção",
  error: "Erro",
};

const STATUS_TONE: Record<Status, { bar: string; pill: string; text: string }> = {
  ok: {
    bar: "bg-[rgb(var(--success))]",
    pill: "bg-[rgb(var(--success))]/15 text-[rgb(var(--success))]",
    text: "text-[rgb(var(--success))]",
  },
  warn: {
    bar: "bg-[rgb(var(--warning))]",
    pill: "bg-[rgb(var(--warning))]/15 text-[rgb(var(--warning))]",
    text: "text-[rgb(var(--warning))]",
  },
  error: {
    bar: "bg-[rgb(var(--danger))]",
    pill: "bg-[rgb(var(--danger))]/15 text-[rgb(var(--danger))]",
    text: "text-[rgb(var(--danger))]",
  },
};

function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toLocaleString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

function summarizeStatus(checks: CheckResult[]): { status: Status; counts: Record<Status, number> } {
  const counts: Record<Status, number> = { ok: 0, warn: 0, error: 0 };
  for (const c of checks) counts[c.status]++;
  const status: Status = counts.error > 0 ? "error" : counts.warn > 0 ? "warn" : "ok";
  return { status, counts };
}

function CheckCard({ check }: { check: CheckResult }) {
  const [open, setOpen] = useState(false);
  const tone = STATUS_TONE[check.status];
  const label = CHECK_LABEL[check.name] ?? check.name;

  return (
    <div className="relative overflow-hidden rounded-xl bg-[rgb(var(--bg-panel))] border border-[rgb(var(--border))]">
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${tone.bar}`} aria-hidden="true" />
      <div className="pl-6 pr-5 py-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-base">{label}</h3>
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${tone.pill}`}>
                <span className={`size-1.5 rounded-full ${tone.bar}`} />
                {STATUS_LABEL[check.status]}
              </span>
            </div>
            <p className="mt-1 text-sm text-[rgb(var(--fg-muted))]">{check.summary}</p>
          </div>
        </div>

        {check.recommendation && (
          <div className="mt-3 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] px-3 py-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--fg-subtle))]">
              Recomendação
            </div>
            <p className="mt-1 text-sm whitespace-pre-line">{check.recommendation}</p>
          </div>
        )}

        <button
          type="button"
          className="mt-3 text-xs text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))] underline-offset-2 hover:underline"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Ocultar detalhes" : "Ver detalhes"}
        </button>

        {open && (
          <pre className="mt-2 text-xs bg-[rgb(var(--bg-subtle))] border border-[rgb(var(--border))] rounded-md p-3 overflow-x-auto">
            {JSON.stringify(check.details, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

export default function DiagnosticsPage() {
  const [report, setReport] = useState<DiagnosticsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<DiagnosticsReport>("/diagnostics");
      setReport(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.status === 403
            ? "Esta página exige papel admin."
            : `${err.status}: ${err.detail}`,
        );
      } else {
        setError(String(err));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = report ? summarizeStatus(report.checks) : null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <header className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Diagnóstico</h1>
          <p className="text-sm text-[rgb(var(--fg-muted))] mt-1">
            Estado dos componentes que costumam quebrar — LM Studio, system prompt e admins.
          </p>
          {report && summary && (
            <div className="mt-3 flex items-center gap-3 text-xs text-[rgb(var(--fg-muted))]">
              <span className={`font-medium ${STATUS_TONE[summary.status].text}`}>
                {summary.counts.error > 0
                  ? `${summary.counts.error} erro${summary.counts.error > 1 ? "s" : ""}`
                  : summary.counts.warn > 0
                    ? `${summary.counts.warn} atenção${summary.counts.warn > 1 ? "s" : ""}`
                    : "tudo ok"}
              </span>
              <span>·</span>
              <span>verificado {formatTimestamp(report.generated_at)}</span>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-md border border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-subtle))] disabled:opacity-50"
        >
          {loading ? "Verificando..." : "Rodar de novo"}
        </button>
      </header>

      {error && (
        <div
          className="mb-4 rounded-md border border-[rgb(var(--danger))]/30 bg-[rgb(var(--danger))]/5 px-4 py-3 text-sm"
          role="alert"
        >
          {error}
        </div>
      )}

      {loading && !report ? (
        <div className="text-sm text-[rgb(var(--fg-muted))]">Verificando ambiente...</div>
      ) : report ? (
        <div className="space-y-3">
          {report.checks.map((c) => (
            <CheckCard key={c.name} check={c} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
