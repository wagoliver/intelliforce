"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api/client";
import { vault } from "@/lib/api/vault";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
};

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function CreateSecretDialog({ open, onClose, onCreated }: Props) {
  const t = useTranslations("vault");
  const tc = useTranslations("common");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [value, setValue] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [reveal, setReveal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSlug("");
      setDescription("");
      setValue("");
      setTagsInput("");
      setReveal(false);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, submitting]);

  if (!open) return null;

  const slugValid = slug.length === 0 || SLUG_RE.test(slug);
  const canSubmit = slug.trim() !== "" && value.trim() !== "" && slugValid && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await vault.create({ slug, description, value, tags });
      await onCreated();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(t("error_slug_exists"));
      } else {
        setError(err instanceof ApiError ? err.detail : String(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="vault-modal-backdrop" role="dialog" aria-modal="true" onClick={() => !submitting && onClose()}>
      <form className="vault-modal vault-create-modal" onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}>
        <h2 className="vault-modal-title">{t("create_title")}</h2>
        <p className="vault-modal-text">{t("create_text")}</p>

        <label className="vault-field">
          <span className="vault-field-label">{t("slug_label")}</span>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            placeholder="zoho-api-token"
            className={`vault-input ${slug && !slugValid ? "is-invalid" : ""}`}
            autoFocus
            required
            maxLength={64}
          />
          <span className={`vault-field-hint ${slug && !slugValid ? "is-invalid" : ""}`}>
            {t("slug_hint")}
          </span>
        </label>

        <label className="vault-field">
          <span className="vault-field-label">{t("description_label")}</span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("description_placeholder")}
            className="vault-input"
            maxLength={500}
          />
        </label>

        <label className="vault-field">
          <span className="vault-field-label">{t("value_label")}</span>
          <div className="vault-input-with-toggle">
            <input
              type={reveal ? "text" : "password"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="sk-..."
              className="vault-input"
              required
              autoComplete="new-password"
              spellCheck={false}
            />
            <button
              type="button"
              className="vault-input-toggle"
              onClick={() => setReveal((r) => !r)}
              aria-label={reveal ? t("hide_value") : t("show_value")}
              tabIndex={-1}
            >
              {reveal ? "Hide" : "Show"}
            </button>
          </div>
          <span className="vault-field-hint">{t("value_hint")}</span>
        </label>

        <label className="vault-field">
          <span className="vault-field-label">{t("tags_label")}</span>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="zoho, prod"
            className="vault-input"
          />
          <span className="vault-field-hint">{t("tags_hint")}</span>
        </label>

        {error && <div className="vault-modal-error" role="alert">{error}</div>}

        <div className="vault-modal-actions">
          <button
            type="button"
            className="vault-btn vault-btn-ghost"
            onClick={onClose}
            disabled={submitting}
          >
            {tc("cancel")}
          </button>
          <button type="submit" className="vault-btn vault-btn-primary" disabled={!canSubmit}>
            {submitting ? tc("creating") : tc("create")}
          </button>
        </div>
      </form>
    </div>
  );
}
