"use client";

import { RefreshCw } from "lucide-react";

import {
  formatRelativeAge,
  type DiagnosticsSummary,
} from "@/lib/api/diagnostics";

interface Props {
  summary: DiagnosticsSummary;
  lastCheck: string;
  onTestAll: () => void;
  busy?: boolean;
}

export function SummaryBar({ summary, lastCheck, onTestAll, busy }: Props) {
  return (
    <section className="summary-bar">
      <div className="summary-stats">
        <div className="summary-stat">
          <div className="summary-stat-l">Saudáveis</div>
          <div className="summary-stat-v">
            <span className="num-ok">{summary.healthy}</span>
            <span className="summary-stat-d">de {summary.total}</span>
          </div>
        </div>
        <div className="summary-stat">
          <div className="summary-stat-l">Atenção</div>
          <div className="summary-stat-v">
            <span className="num-warn">{summary.warning}</span>
          </div>
        </div>
        <div className="summary-stat">
          <div className="summary-stat-l">Erro</div>
          <div className="summary-stat-v">
            <span className="num-err">{summary.error}</span>
          </div>
        </div>
        <div className="summary-stat summary-meta">
          <div className="summary-stat-l">Última verificação</div>
          <div className="summary-stat-v is-mono">{formatRelativeAge(lastCheck)}</div>
        </div>
      </div>
      <button className="btn-primary" onClick={onTestAll} disabled={busy}>
        <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} />
        Testar tudo
      </button>
    </section>
  );
}
