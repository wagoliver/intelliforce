// Baseado em web/app/(app)/skills/components/MarkdownView.tsx — estilo via .md-body.
"use client";

import { marked } from "marked";
import { useMemo } from "react";

marked.setOptions({ breaks: false, gfm: true });

/** Renderiza markdown (marked v14 já escapa HTML por default). */
export function MarkdownView({ source }: { source: string }) {
  const html = useMemo(() => (source ? (marked.parse(source) as string) : ""), [source]);
  if (!html) return null;
  return <div className="md-body" dangerouslySetInnerHTML={{ __html: html }} />;
}
