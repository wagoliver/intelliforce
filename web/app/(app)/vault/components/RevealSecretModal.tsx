"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api/client";
import { vault, type Secret } from "@/lib/api/vault";

type Props = {
  secret: Secret | null;
  onClose: () => void;
};

const AUTO_HIDE_SECONDS = 30;

export function RevealSecretModal({ secret, onClose }: Props) {
  const t = useTranslations("vault");
  const tc = useTranslations("common");
  const [phase, setPhase] = useState<"confirm" | "loading" | "shown" | "error">("confirm");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [secondsLeft, setSecondsLeft] = useState(AUTO_HIDE_SECONDS);

  useEffect(() => {
    if (!secret) {
      setPhase("confirm");
      setFields({});
      setError(null);
      setCopiedKey(null);
      setRevealedKeys(new Set());
      setSecondsLeft(AUTO_HIDE_SECONDS);
    }
  }, [secret]);

  useEffect(() => {
    if (!secret) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [secret, onClose]);

  useEffect(() => {
    if (phase !== "shown") return;
    setSecondsLeft(AUTO_HIDE_SECONDS);
    const id = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          window.clearInterval(id);
          onClose();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase, onClose]);

  if (!secret) return null;

  async function handleConfirm() {
    if (!secret) return;
    setPhase("loading");
    setError(null);
    try {
      const data = await vault.revealAll(secret.slug);
      setFields(data.fields);
      // Default: começa com tudo OCULTO; user revela campo a campo via toggle
      setRevealedKeys(new Set());
      setPhase("shown");
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : String(err));
      setPhase("error");
    }
  }

  function toggleReveal(key: string) {
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleCopy(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
    } catch {
      /* user pode selecionar manual */
    }
  }

  const fieldEntries = Object.entries(fields);

  return (
    <div
      className="vault-modal-backdrop vault-reveal-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="vault-modal vault-reveal-modal" onClick={(e) => e.stopPropagation()}>
        <header className="vault-reveal-header">
          <span className="vault-reveal-eyebrow">{t("reveal_eyebrow")}</span>
          <code className="vault-reveal-slug">{secret.slug}</code>
        </header>

        {phase === "confirm" && (
          <>
            <p className="vault-modal-text">{t("reveal_confirm_text")}</p>
            <p className="vault-reveal-warn">{t("reveal_warn")}</p>
            {secret.field_keys.length > 0 && (
              <div className="vault-reveal-keys-preview">
                <span className="vault-reveal-keys-label">{t("fields_label")}:</span>
                {secret.field_keys.map((k) => (
                  <code key={k} className="vault-reveal-key-chip">{k}</code>
                ))}
              </div>
            )}
            <div className="vault-modal-actions">
              <button type="button" className="vault-btn vault-btn-ghost" onClick={onClose}>
                {tc("cancel")}
              </button>
              <button type="button" className="vault-btn vault-btn-primary" onClick={handleConfirm}>
                {t("reveal_confirm_btn")}
              </button>
            </div>
          </>
        )}

        {phase === "loading" && <div className="vault-modal-text">{tc("loading")}</div>}

        {phase === "error" && (
          <>
            <div className="vault-modal-error" role="alert">{error}</div>
            <div className="vault-modal-actions">
              <button type="button" className="vault-btn vault-btn-ghost" onClick={onClose}>
                {tc("cancel")}
              </button>
            </div>
          </>
        )}

        {phase === "shown" && (
          <>
            <div className="vault-reveal-fields-list">
              {fieldEntries.map(([key, value]) => {
                const isRevealed = revealedKeys.has(key);
                const isCopied = copiedKey === key;
                return (
                  <div key={key} className="vault-reveal-field">
                    <div className="vault-reveal-field-key">{key}</div>
                    <div className="vault-reveal-field-value-row">
                      <code className={`vault-reveal-field-value ${isRevealed ? "" : "is-masked"}`}>
                        {isRevealed ? value : "•".repeat(Math.min(24, Math.max(8, value.length)))}
                      </code>
                      <button
                        type="button"
                        className="vault-btn vault-btn-ghost vault-reveal-field-toggle"
                        onClick={() => toggleReveal(key)}
                        title={isRevealed ? t("hide_value") : t("show_value")}
                      >
                        {isRevealed ? t("hide_value") : t("show_value")}
                      </button>
                      <button
                        type="button"
                        className="vault-btn vault-btn-ghost vault-reveal-field-copy"
                        onClick={() => handleCopy(key, value)}
                      >
                        {isCopied ? t("copied") : t("copy")}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="vault-reveal-timer">{t("auto_hide_in", { n: secondsLeft })}</p>
            <div className="vault-modal-actions">
              <button type="button" className="vault-btn vault-btn-primary" onClick={onClose}>
                {t("close")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
