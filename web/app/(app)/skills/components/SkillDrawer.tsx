"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import {
  deleteOpenCodeItem,
  fetchOpenCodeContent,
  type OpenCodeContent,
  type OpenCodeFile,
} from "../hooks/useOpenCodeTree";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { isSeed } from "../state/seeds";
import { MarkdownView } from "./MarkdownView";

type SelectedKind = OpenCodeFile["kind"] | "script";

type Props = {
  selected: { kind: SelectedKind; slug: string } | null;
  onClose: () => void;
  /** Disparado após exclusão bem-sucedida — pai deve refetch a tree. */
  onDeleted?: () => void;
};

export function SkillDrawer({ selected, onClose, onDeleted }: Props) {
  const [content, setContent] = useState<OpenCodeContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Guard contra double-click: setState é async, não dá pra confiar em
  // `disabled` no botão pra prevenir chamadas duplicadas em sequência rápida.
  const inFlightRef = useRef(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (confirmingDelete) {
          setConfirmingDelete(false);
        } else if (!deleting) {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, onClose, confirmingDelete, deleting]);

  useEffect(() => {
    if (!selected) {
      setContent(null);
      setError(null);
      setConfirmingDelete(false);
      setDeleteError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setContent(null);
    setConfirmingDelete(false);
    setDeleteError(null);
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

  const slideDuration = reducedMotion ? 0 : 0.3;
  const isProtected = selected ? isSeed(selected.kind, selected.slug) : false;
  const canDelete = !!selected && !isProtected;

  async function handleDelete() {
    if (!selected || !canDelete) return;
    if (inFlightRef.current) return; // prevent double-call (sync ref guard)
    inFlightRef.current = true;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteOpenCodeItem(selected.kind, selected.slug);
      // Sucesso: fecha drawer + dispara refetch no pai
      setDeleting(false);
      setConfirmingDelete(false);
      onClose();
      onDeleted?.();
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setDeleteError(detail);
      setDeleting(false);
    } finally {
      inFlightRef.current = false;
    }
  }

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
            onClick={() => !deleting && onClose()}
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
              <div className="skills-drawer-header-actions">
                {canDelete && !confirmingDelete && (
                  <button
                    type="button"
                    className="skills-drawer-action skills-drawer-action--danger"
                    onClick={() => setConfirmingDelete(true)}
                    title={`Excluir ${selected.kind}`}
                    disabled={loading || deleting}
                  >
                    <svg width={12} height={12} viewBox="0 0 16 16" aria-hidden="true">
                      <path
                        d="M4 5h8M6 5V3.5h4V5M5 5v9.2c0 .5.3.8.8.8h4.4c.5 0 .8-.3.8-.8V5"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span>Excluir</span>
                  </button>
                )}
                <button
                  type="button"
                  className="skills-drawer-close"
                  onClick={onClose}
                  aria-label="Fechar"
                  title="Fechar (Esc)"
                  disabled={deleting}
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
              </div>
            </header>

            {/* Confirm de exclusão — substitui o conteúdo enquanto aberto */}
            {confirmingDelete && (
              <section className="skills-drawer-confirm" role="alert">
                <div className="skills-drawer-confirm-icon" aria-hidden="true">
                  <svg width={32} height={32} viewBox="0 0 24 24">
                    <path
                      d="M12 2L2 22h20L12 2z M12 9v6 M12 17.5v.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h3 className="skills-drawer-confirm-title">Excluir {selected.kind}?</h3>
                <p className="skills-drawer-confirm-text">
                  <code>{selected.slug}</code>
                  {selected.kind === "skill" && (
                    <> e todos os scripts dentro</>
                  )}{" "}
                  serão removidos permanentemente.
                </p>
                <p className="skills-drawer-confirm-warn">Esta ação é irreversível.</p>
                {deleteError && (
                  <div className="skills-drawer-confirm-error" role="alert">
                    {deleteError}
                  </div>
                )}
                <div className="skills-drawer-confirm-actions">
                  <button
                    type="button"
                    className="skills-drawer-btn skills-drawer-btn--ghost"
                    onClick={() => {
                      setConfirmingDelete(false);
                      setDeleteError(null);
                    }}
                    disabled={deleting}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="skills-drawer-btn skills-drawer-btn--danger"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting ? "Excluindo…" : "Sim, excluir"}
                  </button>
                </div>
              </section>
            )}

            {!confirmingDelete && (
              <>
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
                    {content.body ? (
                      selected.kind === "script" ? (
                        <MarkdownView
                          source={"```python\n" + content.body + "\n```"}
                          variant="drawer"
                        />
                      ) : (
                        <MarkdownView source={content.body} variant="drawer" />
                      )
                    ) : (
                      <div className="skills-drawer-loading">(corpo vazio)</div>
                    )}
                  </>
                )}
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
