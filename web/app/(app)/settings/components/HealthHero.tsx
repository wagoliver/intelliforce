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

export function HealthHero({ component, onTest, busy }: Props) {
  const [showGuide, setShowGuide] = useState(false);
  const { name, description, status, metric, meta, message, causes, has_guide } = component;

  const variant = status === "err" || status === "warn" ? status : "warn";

  const focalPrimary = meta[0] ?? name;
  const focalSecondary =
    message ?? (metric ? `${metric.value} ${metric.unit ?? ""} · ${metric.label}` : "sem detalhes");

  return (
    <article
      className={`hero is-${variant} ${busy ? "is-loading" : ""}`}
      aria-busy={busy || undefined}
    >
      <header className="hero-head">
        <div className="hero-id">
          <div className="hero-eyebrow">{name}</div>
          <h2 className="hero-title">
            {metric?.value && status !== "err" ? metric.value : description.split(".")[0]}
          </h2>
          <p className="hero-sub">{description}</p>
        </div>
        <StatusChip status={status} />
      </header>

      <div className="hero-focal">
        <div className="hero-focal-primary">{focalPrimary}</div>
        <div className="hero-focal-meta">{focalSecondary}</div>
      </div>

      {causes.length > 0 && (
        <>
          <div className="hero-causes-h">Causas prováveis</div>
          <ul className="hero-causes-list">
            {causes.map((cause, i) => (
              <li key={i}>{cause}</li>
            ))}
          </ul>
        </>
      )}

      <footer className="hero-foot">
        <button
          className={`btn-solid ${variant === "warn" ? "is-warn" : ""}`}
          onClick={onTest}
          disabled={busy}
        >
          {busy ? "Testando…" : "Testar"}
        </button>
        {has_guide && (
          <button
            className="btn-line"
            onClick={() => setShowGuide((v) => !v)}
            aria-expanded={showGuide}
          >
            {showGuide ? "Ocultar guia" : "Como configurar →"}
          </button>
        )}
        {meta.slice(1).length > 0 && (
          <span className="hero-meta-trail">{meta.slice(1).join(" · ")}</span>
        )}
      </footer>

      {showGuide && has_guide && (
        <div className="hero-guide-slot">
          <ConfigGuide componentId={component.id} />
        </div>
      )}
    </article>
  );
}
