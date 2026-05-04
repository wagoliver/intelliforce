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
const FIELD_KEY_RE = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;

type FieldDraft = {
  id: string;            // só pra React key
  key: string;
  value: string;
  reveal: boolean;       // toggle individual show/hide
};

function makeField(): FieldDraft {
  return { id: Math.random().toString(36).slice(2), key: "", value: "", reveal: false };
}

export function CreateSecretDialog({ open, onClose, onCreated }: Props) {
  const t = useTranslations("vault");
  const tc = useTranslations("common");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<FieldDraft[]>(() => [makeField()]);
  const [tagsInput, setTagsInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSlug("");
      setDescription("");
      setFields([makeField()]);
      setTagsInput("");
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
  const fieldKeysSet = new Set<string>();
  let hasDuplicateKey = false;
  let hasInvalidKey = false;
  let hasEmptyValue = false;
  for (const f of fields) {
    if (f.key && !FIELD_KEY_RE.test(f.key)) hasInvalidKey = true;
    if (f.key && fieldKeysSet.has(f.key)) hasDuplicateKey = true;
    fieldKeysSet.add(f.key);
    if (f.key.trim() !== "" && f.value.trim() === "") hasEmptyValue = true;
  }
  const hasFilledFields = fields.some((f) => f.key.trim() && f.value.trim());
  const canSubmit =
    slug.trim() !== "" &&
    slugValid &&
    hasFilledFields &&
    !hasDuplicateKey &&
    !hasInvalidKey &&
    !hasEmptyValue &&
    !submitting;

  function updateField(id: string, patch: Partial<FieldDraft>) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function addField() {
    setFields((prev) => [...prev, makeField()]);
  }

  function removeField(id: string) {
    setFields((prev) => (prev.length === 1 ? prev : prev.filter((f) => f.id !== id)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
      const filledFields = fields
        .filter((f) => f.key.trim() && f.value.trim())
        .map((f) => ({ key: f.key.trim(), value: f.value }));
      await vault.create({ slug, description, fields: filledFields, tags });
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
            placeholder="zoho"
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

        {/* Fields multi-campo */}
        <div className="vault-fields-section">
          <div className="vault-fields-header">
            <span className="vault-field-label">{t("fields_label")}</span>
            <span className="vault-field-hint">{t("fields_hint")}</span>
          </div>

          <div className="vault-fields-list">
            {fields.map((f, idx) => {
              const keyInvalid = !!f.key && !FIELD_KEY_RE.test(f.key);
              const isDuplicate =
                !!f.key &&
                fields.filter((x) => x.key === f.key).length > 1;
              return (
                <div key={f.id} className="vault-field-row">
                  <input
                    type="text"
                    value={f.key}
                    onChange={(e) => updateField(f.id, { key: e.target.value })}
                    placeholder={idx === 0 ? "client_id" : t("field_key_placeholder")}
                    className={`vault-input vault-field-key-input ${keyInvalid || isDuplicate ? "is-invalid" : ""}`}
                    maxLength={64}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <div className="vault-input-with-toggle vault-field-value-input">
                    <input
                      type={f.reveal ? "text" : "password"}
                      value={f.value}
                      onChange={(e) => updateField(f.id, { value: e.target.value })}
                      placeholder="sk-..."
                      className="vault-input"
                      autoComplete="new-password"
                      spellCheck={false}
                    />
                    <button
                      type="button"
                      className="vault-input-toggle"
                      onClick={() => updateField(f.id, { reveal: !f.reveal })}
                      aria-label={f.reveal ? t("hide_value") : t("show_value")}
                      tabIndex={-1}
                    >
                      {f.reveal ? "Hide" : "Show"}
                    </button>
                  </div>
                  <button
                    type="button"
                    className="vault-field-remove"
                    onClick={() => removeField(f.id)}
                    disabled={fields.length === 1}
                    aria-label={t("field_remove_aria")}
                    title={fields.length === 1 ? t("field_remove_disabled") : t("field_remove_aria")}
                  >
                    <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>

          {hasInvalidKey && <span className="vault-field-hint is-invalid">{t("error_field_key_invalid")}</span>}
          {hasDuplicateKey && <span className="vault-field-hint is-invalid">{t("error_field_key_duplicate")}</span>}
          {hasEmptyValue && <span className="vault-field-hint is-invalid">{t("error_field_value_empty")}</span>}

          <button
            type="button"
            className="vault-fields-add"
            onClick={addField}
            disabled={fields.length >= 32}
          >
            <svg width={12} height={12} viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            {t("field_add")}
          </button>
        </div>

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
