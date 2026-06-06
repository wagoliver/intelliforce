// Extração do índice de seções (TOC) a partir do markdown do relatório.
// Usa os headings h2/h3 — h1 é o título do relatório, já exibido no header.

export interface TocHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

/** Slug ASCII-ish estável para ancorar headings (casa com MarkdownDoc). */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .replace(/[^a-z0-9\s-]/g, "") // tira emoji/pontuação
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Extrai headings ATX (## / ###) do markdown. Ignora os que estão dentro de
 * blocos de código fenced (``` ou ~~~). Garante ids únicos com sufixo numérico.
 */
export function extractHeadings(md: string): TocHeading[] {
  const out: TocHeading[] = [];
  const seen = new Map<string, number>();
  let inFence = false;
  let fence = "";

  for (const raw of (md ?? "").split("\n")) {
    const line = raw.trimEnd();
    const fenceMatch = line.match(/^(```|~~~)/);
    if (fenceMatch) {
      if (!inFence) {
        inFence = true;
        fence = fenceMatch[1];
      } else if (line.startsWith(fence)) {
        inFence = false;
      }
      continue;
    }
    if (inFence) continue;

    const m = line.match(/^(#{2,3})\s+(.+?)\s*#*\s*$/);
    if (!m) continue;
    const level = m[1].length as 2 | 3;
    const text = m[2].trim();
    const base = slugify(text) || "secao";
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    const id = n === 0 ? base : `${base}-${n}`;
    out.push({ id, text, level });
  }
  return out;
}
