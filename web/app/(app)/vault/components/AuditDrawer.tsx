"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api/client";
import { vault, type Secret, type SecretAccessLogEntry } from "@/lib/api/vault";

type Props = {
  secret: Secret | null;
  onClose: () => void;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function actionIcon(action: string) {
  switch (action) {
    case "create":
      return (
        <path
          d="M8 3v10M3 8h10"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
      );
    case "read":
      return (
        <g stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round">
          <path d="M2 8s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" />
          <circle cx="8" cy="8" r="1.6" fill="currentColor" />
        </g>
      );
    case "delete":
      return (
        <path
          d="M4 4l8 8M12 4l-8 8"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
      );
    default:
      return <circle cx="8" cy="8" r="2" fill="currentColor" />;
  }
}

export function AuditDrawer({ secret, onClose }: Props) {
  const t = useTranslations("vault");
  const tc = useTranslations("common");
  const [entries, setEntries] = useState<SecretAccessLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!secret) {
      setEntries([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    vault
      .audit(secret.slug)
      .then((list) => {
        if (!cancelled) setEntries(list);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.detail : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [secret]);

  useEffect(() => {
    if (!secret) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [secret, onClose]);

  return (
    <AnimatePresence>
      {secret && (
        <>
          <motion.div
            key="vault-audit-backdrop"
            className="vault-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.aside
            key="vault-audit-drawer"
            className="vault-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={`audit ${secret.slug}`}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          >
            <header className="vault-drawer-header">
              <div>
                <span className="vault-drawer-eyebrow">{t("audit_title")}</span>
                <code className="vault-drawer-slug">{secret.slug}</code>
              </div>
              <button
                type="button"
                className="vault-drawer-close"
                onClick={onClose}
                aria-label={tc("back")}
                title="Esc"
              >
                <svg width={12} height={12} viewBox="0 0 16 16" aria-hidden="true">
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

            <div className="vault-drawer-body">
              {loading && <div className="vault-drawer-loading">{tc("loading")}</div>}
              {error && (
                <div className="vault-modal-error" role="alert">
                  {error}
                </div>
              )}
              {!loading && !error && entries.length === 0 && (
                <div className="vault-drawer-empty">{t("audit_empty")}</div>
              )}
              {!loading && !error && entries.length > 0 && (
                <ul className="vault-audit-list">
                  {entries.map((e) => (
                    <li key={e.id} className={`vault-audit-row vault-audit-${e.action}`}>
                      <span className="vault-audit-icon" aria-hidden="true">
                        <svg viewBox="0 0 16 16" width={14} height={14}>
                          {actionIcon(e.action)}
                        </svg>
                      </span>
                      <div className="vault-audit-main">
                        <div className="vault-audit-action">{t(`action_${e.action}`)}</div>
                        <div className="vault-audit-actor">
                          {e.accessed_by_skill ? (
                            <>
                              <span className="vault-audit-tag">skill</span>
                              <code>{e.accessed_by_skill}</code>
                              {e.accessed_by_task_id && (
                                <span className="vault-audit-task">
                                  · task {e.accessed_by_task_id.slice(0, 8)}
                                </span>
                              )}
                            </>
                          ) : e.accessed_by_user_id ? (
                            <>
                              <span className="vault-audit-tag">user</span>
                              <code>{e.accessed_by_user_id.slice(0, 8)}</code>
                            </>
                          ) : (
                            <span className="vault-audit-task">{t("audit_unknown_actor")}</span>
                          )}
                        </div>
                        <div className="vault-audit-time">{formatTime(e.accessed_at)}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
