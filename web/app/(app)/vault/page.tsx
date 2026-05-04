"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ApiError } from "@/lib/api/client";
import { vault, type Secret } from "@/lib/api/vault";

import { AuditDrawer } from "./components/AuditDrawer";
import { CreateSecretDialog } from "./components/CreateSecretDialog";
import { RevealSecretModal } from "./components/RevealSecretModal";
import { useSecrets } from "./hooks/useSecrets";

function LockIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M6 11V8a6 6 0 0 1 12 0v3M5 11h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="15.5" r="1.4" fill="currentColor" />
    </svg>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function VaultPage() {
  const t = useTranslations("vault");
  const tc = useTranslations("common");
  const { secrets, loading, error, refetch } = useSecrets();
  const [createOpen, setCreateOpen] = useState(false);
  const [revealing, setRevealing] = useState<Secret | null>(null);
  const [auditing, setAuditing] = useState<Secret | null>(null);
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<Secret | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleDelete(secret: Secret) {
    setDeletingSlug(secret.slug);
    setActionError(null);
    try {
      await vault.remove(secret.slug);
      setConfirmingDelete(null);
      await refetch();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.detail : String(err));
    } finally {
      setDeletingSlug(null);
    }
  }

  return (
    <>
      <header className="vault-header">
        <div>
          <span className="vault-eyebrow">
            <LockIcon size={14} />
            {t("eyebrow")}
          </span>
          <h1 className="vault-title">{t("title")}</h1>
          <p className="vault-sub">{t("sub")}</p>
        </div>
        <button
          type="button"
          className="vault-btn vault-btn-primary"
          onClick={() => setCreateOpen(true)}
        >
          <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          {t("new_secret")}
        </button>
      </header>

      {error && (
        <div className="vault-banner vault-banner-error" role="alert">
          {error}
        </div>
      )}
      {actionError && (
        <div className="vault-banner vault-banner-error" role="alert">
          {actionError}
        </div>
      )}

      {loading ? (
        <div className="vault-empty">{tc("loading")}</div>
      ) : secrets.length === 0 ? (
        <div className="vault-empty">
          <div className="vault-empty-icon">
            <LockIcon size={28} />
          </div>
          <h2>{t("empty_title")}</h2>
          <p>{t("empty_sub")}</p>
          <button
            type="button"
            className="vault-btn vault-btn-primary"
            onClick={() => setCreateOpen(true)}
          >
            {t("create_first")}
          </button>
        </div>
      ) : (
        <ul className="vault-grid">
          {secrets.map((s) => (
            <li key={s.id} className="vault-card">
              <div className="vault-card-head">
                <span className="vault-card-icon">
                  <LockIcon size={16} />
                </span>
                <code className="vault-card-slug">{s.slug}</code>
                <span className="vault-card-fieldcount" title={t("field_count_tooltip")}>
                  {s.field_keys.length === 1
                    ? t("field_count_one")
                    : t("field_count_n", { n: s.field_keys.length })}
                </span>
              </div>
              {s.description && <p className="vault-card-desc">{s.description}</p>}
              {s.field_keys.length > 0 && (
                <div className="vault-card-fieldkeys">
                  {s.field_keys.map((k) => (
                    <code key={k} className="vault-card-fieldkey">{k}</code>
                  ))}
                </div>
              )}
              {s.tags.length > 0 && (
                <div className="vault-card-tags">
                  {s.tags.map((tag) => (
                    <span key={tag} className="vault-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <dl className="vault-card-meta">
                <div>
                  <dt>{t("created_at")}</dt>
                  <dd>{formatDate(s.created_at)}</dd>
                </div>
                <div>
                  <dt>{t("last_access")}</dt>
                  <dd>{formatDate(s.last_accessed_at) ?? t("never_accessed")}</dd>
                </div>
              </dl>
              <div className="vault-card-actions">
                <button
                  type="button"
                  className="vault-btn vault-btn-ghost"
                  onClick={() => setRevealing(s)}
                >
                  {t("reveal")}
                </button>
                <button
                  type="button"
                  className="vault-btn vault-btn-ghost"
                  onClick={() => setAuditing(s)}
                >
                  {t("audit")}
                </button>
                <button
                  type="button"
                  className="vault-btn vault-btn-danger"
                  onClick={() => setConfirmingDelete(s)}
                  disabled={deletingSlug === s.slug}
                >
                  {tc("delete")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <CreateSecretDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={async () => {
          setCreateOpen(false);
          await refetch();
        }}
      />

      <RevealSecretModal
        secret={revealing}
        onClose={() => {
          setRevealing(null);
          void refetch();
        }}
      />

      <AuditDrawer secret={auditing} onClose={() => setAuditing(null)} />

      {confirmingDelete && (
        <div
          className="vault-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => deletingSlug ? null : setConfirmingDelete(null)}
        >
          <div className="vault-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="vault-modal-title">{t("delete_title")}</h2>
            <p className="vault-modal-text">
              {t("delete_text", { slug: confirmingDelete.slug })}
            </p>
            <p className="vault-modal-warn">{tc("irreversible")}</p>
            <div className="vault-modal-actions">
              <button
                type="button"
                className="vault-btn vault-btn-ghost"
                onClick={() => setConfirmingDelete(null)}
                disabled={!!deletingSlug}
              >
                {tc("cancel")}
              </button>
              <button
                type="button"
                className="vault-btn vault-btn-danger"
                onClick={() => handleDelete(confirmingDelete)}
                disabled={!!deletingSlug}
              >
                {deletingSlug ? tc("loading") : tc("yes_delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
