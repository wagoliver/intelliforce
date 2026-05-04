"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type AskQuestion = {
  id: string;
  label: string;
  type?: "text" | "textarea" | "number" | "select" | "boolean";
  required?: boolean;
  hint?: string;
  placeholder?: string;
  options?: string[];
  default?: string | number | boolean;
};

type Status = "open" | "submitted" | "cancelled" | "freeform";

type Props = {
  questions: AskQuestion[];
  /** Submit consolidado: array de {id, label, value} pra agente parsear. */
  onSubmit: (answers: { id: string; label: string; value: string }[]) => void;
  /** User cancelou — agente é informado que vai mudar de assunto. */
  onCancel: () => void;
  /** User quer responder em texto livre — form some, sem enviar mensagem. */
  onSwitchToFreeForm: () => void;
};

/**
 * Form inline renderizado dentro de uma agent message quando ela contém um
 * bloco ` ```ask ` com array JSON de perguntas. User pode:
 *  - Preencher e enviar (consolida em texto pro agente)
 *  - Cancelar (agente é avisado)
 *  - Sair pra texto livre (form some, composer foca, agente não é avisado)
 *  - Apertar ESC (= "texto livre")
 *
 * Required marca visual mas não bloqueia submit. Após submit, form fica
 * em modo readonly mostrando "✓ Respostas enviadas".
 */
export function AskForm({ questions, onSubmit, onCancel, onSwitchToFreeForm }: Props) {
  const [status, setStatus] = useState<Status>("open");
  const [answers, setAnswers] = useState<Record<string, string | boolean>>(() =>
    Object.fromEntries(
      questions.map((q) => [
        q.id,
        q.type === "boolean"
          ? Boolean(q.default ?? false)
          : String(q.default ?? ""),
      ]),
    ),
  );

  const containerRef = useRef<HTMLDivElement | null>(null);

  const missingRequired = useMemo(() => {
    return questions
      .filter((q) => q.required)
      .filter((q) => {
        if (q.type === "boolean") return false; // boolean tem default
        const v = answers[q.id];
        return typeof v === "string" ? v.trim() === "" : !v;
      })
      .map((q) => q.label);
  }, [answers, questions]);

  // Esc → texto livre (sair sem enviar)
  useEffect(() => {
    if (status !== "open") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const target = e.target as HTMLElement;
        if (containerRef.current?.contains(target)) {
          e.preventDefault();
          setStatus("freeform");
          onSwitchToFreeForm();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, onSwitchToFreeForm]);

  if (status === "submitted") {
    return (
      <div className="skills-askform skills-askform--done">
        <span className="skills-askform-done-icon" aria-hidden="true">✓</span>
        Respostas enviadas
      </div>
    );
  }
  if (status === "cancelled") {
    return (
      <div className="skills-askform skills-askform--done">
        <span className="skills-askform-done-icon" aria-hidden="true">⨯</span>
        Questionário cancelado
      </div>
    );
  }
  if (status === "freeform") {
    return null; // some — user vai responder livre no composer
  }

  function handleSubmit() {
    const consolidated = questions.map((q) => {
      const v = answers[q.id];
      let value: string;
      if (q.type === "boolean") value = v ? "sim" : "não";
      else if (typeof v === "boolean") value = v ? "sim" : "não";
      else value = (v ?? "").toString().trim() || "(não respondido)";
      return { id: q.id, label: q.label, value };
    });
    setStatus("submitted");
    onSubmit(consolidated);
  }

  function handleCancel() {
    setStatus("cancelled");
    onCancel();
  }

  function handleFreeForm() {
    setStatus("freeform");
    onSwitchToFreeForm();
  }

  return (
    <div ref={containerRef} className="skills-askform" role="form" aria-label="Formulário de respostas">
      <header className="skills-askform-header">
        <span className="skills-askform-eyebrow">responder ao agente</span>
        <span className="skills-askform-count">
          {questions.length} {questions.length === 1 ? "pergunta" : "perguntas"}
        </span>
      </header>

      <div className="skills-askform-fields">
        {questions.map((q) => (
          <AskField
            key={q.id}
            question={q}
            value={answers[q.id]}
            onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
          />
        ))}
      </div>

      {missingRequired.length > 0 && (
        <div className="skills-askform-warn" role="status">
          <strong>Aviso:</strong> {missingRequired.length} campo(s) obrigatório(s) sem resposta — pode enviar assim mesmo
          ({missingRequired.slice(0, 3).join(", ")}{missingRequired.length > 3 ? "…" : ""}) ou clicar em "Texto livre" pra responder em conversa.
        </div>
      )}

      <footer className="skills-askform-actions">
        <button
          type="button"
          className="skills-askform-btn skills-askform-btn--ghost"
          onClick={handleCancel}
          title="Avisa o agente que você quer cancelar"
        >
          Cancelar
        </button>
        <button
          type="button"
          className="skills-askform-btn skills-askform-btn--ghost"
          onClick={handleFreeForm}
          title="Esc · Fecha o form e responde em texto livre no composer abaixo"
        >
          Texto livre
        </button>
        <button
          type="button"
          className="skills-askform-btn skills-askform-btn--primary"
          onClick={handleSubmit}
        >
          Enviar respostas
        </button>
      </footer>
    </div>
  );
}

function AskField({
  question,
  value,
  onChange,
}: {
  question: AskQuestion;
  value: string | boolean;
  onChange: (v: string | boolean) => void;
}) {
  const type = question.type ?? "text";
  const labelId = `askfield-${question.id}`;

  const labelEl = (
    <label htmlFor={labelId} className="skills-askform-label">
      {question.label}
      {question.required && <span className="skills-askform-req" aria-label="obrigatório"> *</span>}
    </label>
  );

  return (
    <div className="skills-askform-field">
      {type !== "boolean" && labelEl}

      {type === "text" && (
        <input
          id={labelId}
          type="text"
          className="skills-askform-input"
          placeholder={question.placeholder}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {type === "number" && (
        <input
          id={labelId}
          type="number"
          className="skills-askform-input"
          placeholder={question.placeholder}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {type === "textarea" && (
        <textarea
          id={labelId}
          className="skills-askform-input skills-askform-textarea"
          placeholder={question.placeholder}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
        />
      )}

      {type === "select" && (
        <select
          id={labelId}
          className="skills-askform-input skills-askform-select"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="" disabled hidden>{question.placeholder ?? "Selecione…"}</option>
          {(question.options ?? []).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      )}

      {type === "boolean" && (
        <label htmlFor={labelId} className="skills-askform-bool">
          <input
            id={labelId}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="skills-askform-bool-label">
            {question.label}
            {question.required && <span className="skills-askform-req"> *</span>}
          </span>
        </label>
      )}

      {question.hint && <div className="skills-askform-hint">{question.hint}</div>}
    </div>
  );
}
