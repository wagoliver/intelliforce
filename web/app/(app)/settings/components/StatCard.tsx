"use client";

import { useState } from "react";

import type { DiagnosticComponent } from "@/lib/api/diagnostics";

import { ConfigGuide } from "./ConfigGuide";
import { StatusChip } from "./StatusChip";

interface Props {
  component: DiagnosticComponent;
  onTest: () => void;
  busy?: boolean;
}

export function StatCard({ component, onTest, busy }: Props) {
  const [showGuide, setShowGuide] = useState(false);
  const { name, status, metric, meta, has_guide } = component;

  return (
    <article
      className={`stat-card is-${status} ${busy ? "is-loading" : ""}`}
      aria-busy={busy || undefined}
    >
      <header className="stat-head">
        <div className="stat-title">{name}</div>
        <StatusChip status={status} />
      </header>

      <div className="metric">
        {metric ? (
          <div className="metric-v">
            {metric.value}
            {metric.suffix ? <span className="metric-v-suffix">{metric.suffix}</span> : null}
            {metric.unit ? <span className="metric-v-unit">{metric.unit}</span> : null}
          </div>
        ) : (
          <div className="metric-v">—</div>
        )}
        <div className="metric-l">{metric?.label ?? "estado"}</div>
      </div>

      <div className="stat-meta">
        {meta.map((line, i) => (
          <span key={i}>{line}</span>
        ))}
        {component.message ? <span>{component.message}</span> : null}
      </div>

      <footer className="stat-foot">
        {has_guide && (
          <button
            className="btn-ghost"
            onClick={() => setShowGuide((v) => !v)}
            aria-expanded={showGuide}
          >
            {showGuide ? "Ocultar guia" : "Como configurar"}
          </button>
        )}
        <button className="btn-ghost" onClick={onTest} disabled={busy}>
          {busy ? "Testando…" : "Testar"}
        </button>
      </footer>

      {showGuide && has_guide && (
        <div className="stat-guide-slot">
          <ConfigGuide componentId={component.id} />
        </div>
      )}
    </article>
  );
}
