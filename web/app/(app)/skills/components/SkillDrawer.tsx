"use client";

import { useEffect, useState } from "react";

import { fetchOpenCodeContent, type OpenCodeContent, type OpenCodeFile } from "../hooks/useOpenCodeTree";

type Props = {
  selected: { kind: OpenCodeFile["kind"]; slug: string } | null;
  onClose: () => void;
};

export function SkillDrawer({ selected, onClose }: Props) {
  const [content, setContent] = useState<OpenCodeContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fecha com Esc
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, onClose]);

  // Busca conteúdo quando seleção muda
  useEffect(() => {
    if (!selected) {
      setContent(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setContent(null);
    fetchOpenCodeContent(selected.kind, selected.slug)
      .then((c) => {
        if (!cancelled) setContent(c);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  if (!selected) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.18)",
          zIndex: 40,
        }}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${selected.kind} ${selected.slug}`}
        style={{
          position: "fixed",
          right: 0,
          top: 0,
          bottom: 0,
          width: "min(560px, 92vw)",
          background: "var(--bg-elev)",
          borderLeft: "1px solid var(--border)",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          zIndex: 50,
          overflowY: "auto",
          boxShadow: "-12px 0 24px rgba(0,0,0,0.08)",
        }}
      >
        <header style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10.5,
                color: "var(--text-subtle)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              {selected.kind}
            </span>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 18,
                fontWeight: 500,
                margin: 0,
                color: "var(--text)",
                letterSpacing: "-0.01em",
              }}
            >
              {selected.slug}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            title="Fechar (Esc)"
            style={{
              width: 28,
              height: 28,
              border: "1px solid var(--border)",
              borderRadius: 6,
              background: "transparent",
              color: "var(--text-muted)",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <svg width={12} height={12} viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
            </svg>
          </button>
        </header>

        {loading && <div style={{ fontSize: 12, color: "var(--text-subtle)" }}>carregando…</div>}
        {error && (
          <div role="alert" style={{ fontSize: 12.5, color: "var(--danger)" }}>
            {error}
          </div>
        )}

        {content && (
          <>
            {Object.keys(content.frontmatter).length > 0 && (
              <section
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: "10px 12px",
                  background: "var(--bg-sunken)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <div
                  style={{
                    fontSize: 10.5,
                    fontFamily: "var(--font-mono)",
                    color: "var(--text-subtle)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    marginBottom: 4,
                  }}
                >
                  frontmatter
                </div>
                {Object.entries(content.frontmatter).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", gap: 8, fontSize: 12, alignItems: "baseline" }}>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-subtle)", minWidth: 90 }}>{k}</span>
                    <span style={{ color: "var(--text)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {typeof v === "string" ? v : JSON.stringify(v)}
                    </span>
                  </div>
                ))}
              </section>
            )}
            <pre
              style={{
                margin: 0,
                padding: "12px 14px",
                border: "1px solid var(--border)",
                borderRadius: 6,
                background: "var(--bg)",
                fontSize: 12,
                lineHeight: 1.55,
                color: "var(--text)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontFamily: "var(--font-mono)",
                overflow: "auto",
                maxHeight: "62vh",
              }}
            >
              {content.body || "(corpo vazio)"}
            </pre>
          </>
        )}
      </aside>
    </>
  );
}
