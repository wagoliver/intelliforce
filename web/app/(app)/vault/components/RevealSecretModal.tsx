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
  const [value, setValue] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(AUTO_HIDE_SECONDS);

  useEffect(() => {
    if (!secret) {
      setPhase("confirm");
      setValue("");
      setError(null);
      setCopied(false);
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
      const data = await vault.reveal(secret.slug);
      setValue(data.value);
      setPhase("shown");
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : String(err));
      setPhase("error");
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore — user pode selecionar manual */
    }
  }

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
            <div className="vault-modal-error" role="alert">
              {error}
            </div>
            <div className="vault-modal-actions">
              <button type="button" className="vault-btn vault-btn-ghost" onClick={onClose}>
                {tc("cancel")}
              </button>
            </div>
          </>
        )}

        {phase === "shown" && (
          <>
            <div className="vault-reveal-value-box">
              <code className="vault-reveal-value">{value}</code>
              <button
                type="button"
                className="vault-btn vault-btn-ghost vault-reveal-copy"
                onClick={handleCopy}
              >
                {copied ? t("copied") : t("copy")}
              </button>
            </div>
            <p className="vault-reveal-timer">
              {t("auto_hide_in", { n: secondsLeft })}
            </p>
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
