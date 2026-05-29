"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

import {
  diagnostics,
  type ComponentId,
  type ConfigGuide as ConfigGuideData,
} from "@/lib/api/diagnostics";

interface Props {
  componentId: ComponentId;
}

export function ConfigGuide({ componentId }: Props) {
  const [guide, setGuide] = useState<ConfigGuideData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    diagnostics
      .guide(componentId)
      .then((data) => {
        if (!cancelled) setGuide(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message ?? "Guia indisponível");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [componentId]);

  if (loading) {
    return <div className="guide-loading">Carregando guia…</div>;
  }
  if (error || !guide) {
    return <div className="guide-error">Não foi possível carregar o guia: {error}</div>;
  }

  return (
    <div className="guide">
      <div className="guide-eyebrow">Como configurar</div>
      <h3 className="guide-title">{guide.title}</h3>
      <p className="guide-intro">{guide.intro}</p>

      <ol className="guide-steps">
        {guide.steps.map((step, i) => (
          <li key={i} className="guide-step">
            <div className="guide-step-title">{step.title}</div>
            <div className="guide-step-body">{step.body}</div>
            {step.snippet && <Snippet text={step.snippet} />}
          </li>
        ))}
      </ol>

      {guide.footer_note && <p className="guide-foot">{guide.footer_note}</p>}
    </div>
  );
}

function Snippet({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="guide-snippet-wrap">
      <pre className="guide-snippet">{text}</pre>
      <button
        type="button"
        className="guide-snippet-copy"
        onClick={handleCopy}
        aria-label="Copiar"
        title="Copiar"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? "copiado" : "copiar"}
      </button>
    </div>
  );
}
