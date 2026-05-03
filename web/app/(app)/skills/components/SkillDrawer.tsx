"use client";

import { AnimatePresence, motion } from "framer-motion";
import { marked } from "marked";
import { useEffect, useMemo, useState } from "react";

import { fetchOpenCodeContent, type OpenCodeContent, type OpenCodeFile } from "../hooks/useOpenCodeTree";
import { useReducedMotion } from "../hooks/useReducedMotion";

type Props = {
  selected: { kind: OpenCodeFile["kind"]; slug: string } | null;
  onClose: () => void;
};

marked.setOptions({ breaks: false, gfm: true });

export function SkillDrawer({ selected, onClose }: Props) {
  const [content, setContent] = useState<OpenCodeContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, onClose]);

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

  const renderedBody = useMemo(() => {
    if (!content?.body) return null;
    return marked.parse(content.body) as string;
  }, [content]);

  const slideDuration = reducedMotion ? 0 : 0.3;

  return (
    <AnimatePresence>
      {selected && (
        <>
          <motion.div
            key="backdrop"
            className="skills-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: slideDuration }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.aside
            key="drawer"
            className="skills-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={`${selected.kind} ${selected.slug}`}
            initial={{ x: reducedMotion ? 0 : "100%", opacity: reducedMotion ? 0 : 1 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: reducedMotion ? 0 : "100%", opacity: reducedMotion ? 0 : 1 }}
            transition={{ duration: slideDuration, ease: [0.32, 0.72, 0, 1] }}
          >
            <header className="skills-drawer-header">
              <div>
                <span className="skills-drawer-eyebrow">{selected.kind}</span>
                <h2 className="skills-drawer-title">{selected.slug}</h2>
              </div>
              <button
                type="button"
                className="skills-drawer-close"
                onClick={onClose}
                aria-label="Fechar"
                title="Fechar (Esc)"
              >
                <svg width={12} height={12} viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M4 4l8 8M12 4l-8 8"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
              </button>
            </header>

            {loading && <div className="skills-drawer-loading">carregando…</div>}
            {error && (
              <div role="alert" className="skills-drawer-error">
                {error}
              </div>
            )}

            {content && (
              <>
                {Object.keys(content.frontmatter).length > 0 && (
                  <section className="skills-drawer-fm">
                    <div className="skills-drawer-fm-label">frontmatter</div>
                    {Object.entries(content.frontmatter).map(([k, v]) => (
                      <div key={k} className="skills-drawer-fm-row">
                        <span className="skills-drawer-fm-key">{k}</span>
                        <span className="skills-drawer-fm-value">
                          {typeof v === "string" ? v : JSON.stringify(v, null, 2)}
                        </span>
                      </div>
                    ))}
                  </section>
                )}
                {renderedBody ? (
                  <div className="skills-markdown" dangerouslySetInnerHTML={{ __html: renderedBody }} />
                ) : (
                  <div className="skills-drawer-loading">(corpo vazio)</div>
                )}
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
