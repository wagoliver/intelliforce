"use client";

import { marked } from "marked";
import { useMemo } from "react";

marked.setOptions({ breaks: false, gfm: true });

type Props = {
  source: string;
  /**
   * Variante visual:
   *  - "drawer" (default): full markdown styling (h1-3 grandes, code blocks,
   *    tables, blockquotes — usado no SkillDrawer)
   *  - "bubble": tighter spacing pra caber dentro de um chat bubble
   *    (h1-3 menores, sem margin no topo/fundo)
   */
  variant?: "drawer" | "bubble";
};

/**
 * Renderiza markdown via `marked` v14 dentro de uma div estilizada por
 * `.skills-markdown`. Sanitização: marked já escapa HTML por default.
 *
 * Tolerante a markdown parcial (chunks chegando via streaming) — listas
 * abertas, code fences sem fechar etc renderizam progressivamente sem
 * flicker. Tabela parcial pode quebrar visualmente; aceito como tradeoff.
 */
export function MarkdownView({ source, variant = "drawer" }: Props) {
  const html = useMemo(() => {
    if (!source) return "";
    return marked.parse(source) as string;
  }, [source]);

  if (!html) return null;

  const className = `skills-markdown skills-markdown--${variant}`;
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
