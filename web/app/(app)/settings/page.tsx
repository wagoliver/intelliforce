"use client";

import { useEffect, useState } from "react";

import {
  diagnostics,
  severityRank,
  type ComponentId,
  type DiagnosticComponent,
  type DiagnosticsStatus,
} from "@/lib/api/diagnostics";

import { HealthHero } from "./components/HealthHero";
import { StatCard } from "./components/StatCard";
import { SummaryBar } from "./components/SummaryBar";

import "./settings.css";

export default function SettingsPage() {
  const [status, setStatus] = useState<DiagnosticsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [busyAll, setBusyAll] = useState(false);
  const [busyOne, setBusyOne] = useState<ComponentId | null>(null);

  useEffect(() => {
    let cancelled = false;
    diagnostics
      .status()
      .then((data) => {
        if (!cancelled) setStatus(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setFetchError(err.message ?? "Falha ao carregar diagnóstico");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleTestAll() {
    setBusyAll(true);
    try {
      const data = await diagnostics.status();
      setStatus(data);
      setFetchError(null);
    } catch (err) {
      setFetchError((err as Error).message);
    } finally {
      setBusyAll(false);
    }
  }

  async function handleTestOne(id: ComponentId) {
    setBusyOne(id);
    try {
      const updated = await diagnostics.test(id);
      setStatus((prev) => {
        if (!prev) return prev;
        const components = prev.components.map((c) => (c.id === id ? updated : c));
        return {
          ...prev,
          components,
          summary: recomputeSummary(components),
        };
      });
    } catch (err) {
      setFetchError((err as Error).message);
    } finally {
      setBusyOne(null);
    }
  }

  if (loading) {
    return (
      <div className="settings-canvas">
        <div className="diag-loading">Carregando diagnóstico…</div>
      </div>
    );
  }

  if (fetchError && !status) {
    return (
      <div className="settings-canvas">
        <div className="diag-fetch-error">Não foi possível carregar: {fetchError}</div>
      </div>
    );
  }

  if (!status) return null;

  const heroComponent = pickHero(status.components);
  const otherComponents = status.components.filter((c) => c.id !== heroComponent?.id);

  return (
    <div className="settings-canvas">
      <header className="settings-header">
        <div className="settings-eyebrow">Sistema</div>
        <h1 className="settings-title">Configurações & Saúde</h1>
        <p className="settings-sub">
          Estado das peças que mantêm a plataforma rodando. Use <em>Testar</em> pra revalidar
          um componente; <em>Como configurar</em> abre o guia.
        </p>
      </header>

      <SummaryBar
        summary={status.summary}
        lastCheck={status.last_check}
        onTestAll={handleTestAll}
        busy={busyAll}
      />

      {heroComponent && (
        <HealthHero
          component={heroComponent}
          onTest={() => handleTestOne(heroComponent.id)}
          busy={busyOne === heroComponent.id || busyAll}
        />
      )}

      <section className="stat-grid">
        {otherComponents.map((c) => (
          <StatCard
            key={c.id}
            component={c}
            onTest={() => handleTestOne(c.id)}
            busy={busyOne === c.id || busyAll}
          />
        ))}
      </section>
    </div>
  );
}

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------

function pickHero(components: DiagnosticComponent[]): DiagnosticComponent | null {
  let worst: DiagnosticComponent | null = null;
  let worstRank = 0;
  for (const c of components) {
    const r = severityRank(c.status);
    if (r > worstRank) {
      worstRank = r;
      worst = c;
    }
  }
  return worstRank >= 2 ? worst : null;
}

function recomputeSummary(components: DiagnosticComponent[]) {
  return {
    healthy: components.filter((c) => c.status === "ok").length,
    warning: components.filter((c) => c.status === "warn").length,
    error: components.filter((c) => c.status === "err").length,
    unknown: components.filter((c) => c.status === "unknown").length,
    total: components.length,
  };
}
