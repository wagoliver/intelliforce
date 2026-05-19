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
  const label = CHECK_LABEL[check.name] ?? check.name;

  return (
    <div className={`diagnostics-card diagnostics-card--${check.status}`}>
      <div className="diagnostics-card-head">
        <h3 className="diagnostics-card-title">{label}</h3>
        <span className={`diagnostics-pill diagnostics-pill--${check.status}`}>
          <span className="diagnostics-pill-dot" aria-hidden="true" />
          {STATUS_LABEL[check.status]}
        </span>
      </div>

      <p className="diagnostics-card-summary">{check.summary}</p>

      {check.recommendation && (
        <div className="diagnostics-recommendation">
          <div className="diagnostics-recommendation-label">Recomendação</div>
          <p className="diagnostics-recommendation-text">{check.recommendation}</p>
        </div>
      )}

      <button
        type="button"
        className="diagnostics-details-toggle"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "Ocultar detalhes" : "Ver detalhes"}
      </button>

      {open && (
        <pre className="diagnostics-details-pre">
          {JSON.stringify(check.details, null, 2)}
        </pre>
      )}
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
    <div className="diagnostics-content">
      <div className="diagnostics-inner">
        <header className="diagnostics-header">
          <div className="diagnostics-header-text">
            <span className="diagnostics-eyebrow">
              <span className="diagnostics-eyebrow-dot" aria-hidden="true" />
              Saúde do ambiente
            </span>
            <h1 className="diagnostics-title">Diagnóstico</h1>
            <p className="diagnostics-subtitle">
              Estado dos componentes que costumam quebrar — LM Studio, system prompt e admins.
            </p>
            {report && summary && (
              <div className="diagnostics-meta">
                <span className={`diagnostics-meta-status diagnostics-meta-status--${summary.status}`}>
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
            className="diagnostics-rerun"
          >
            {loading ? (
              <>
                <span className="diagnostics-rerun-spinner" aria-hidden="true" />
                Verificando…
              </>
            ) : (
              "Rodar de novo"
            )}
          </button>
        </header>

        {error && (
          <div className="diagnostics-error-banner" role="alert">
            {error}
          </div>
        )}

        {loading && !report ? (
          <div className="diagnostics-empty-msg">Verificando ambiente…</div>
        ) : report ? (
          <div className="diagnostics-checks">
            {report.checks.map((c) => (
              <CheckCard key={c.name} check={c} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
