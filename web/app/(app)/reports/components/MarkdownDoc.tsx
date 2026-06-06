"use client";

import { marked, type Token } from "marked";
import { useMemo, useState, type ReactNode } from "react";

import { chartableTable, parseMarkdownTables } from "@/lib/reports/tables";
import { slugify } from "@/lib/reports/toc";

import { ReportChart } from "./ReportChart";

marked.setOptions({ breaks: false, gfm: true });

/**
 * Renderiza o markdown do relatório token a token (via `marked.lexer`) para que:
 *  - headings h2/h3 recebam `id`s (consistentes com extractHeadings) p/ o TOC;
 *  - tabelas numéricas ganhem um toggle tabela ⇄ gráfico (ReportChart).
 * O restante é renderizado como HTML por `marked` (sanitização default do marked).
 */
export function MarkdownDoc({ source }: { source: string }) {
  const nodes = useMemo(() => renderTokens(source), [source]);
  return <div className="report-doc">{nodes}</div>;
}

function renderTokens(source: string): ReactNode[] {
  const tokens = marked.lexer(source ?? "");
  const out: ReactNode[] = [];
  const seen = new Map<string, number>();
  let buffer = ""; // acumula tokens "comuns" pra um único parse de HTML
  let key = 0;

  const flush = () => {
    if (!buffer.trim()) {
      buffer = "";
      return;
    }
    const html = marked.parse(buffer) as string;
    out.push(<div key={`h-${key++}`} dangerouslySetInnerHTML={{ __html: html }} />);
    buffer = "";
  };

  for (const token of tokens as Token[]) {
    if (token.type === "heading" && (token.depth === 2 || token.depth === 3)) {
      flush();
      const base = slugify(token.text) || "secao";
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      const id = n === 0 ? base : `${base}-${n}`;
      const inner = marked.parseInline(token.text) as string;
      const Tag = (token.depth === 2 ? "h2" : "h3") as "h2" | "h3";
      out.push(
        <Tag key={`t-${key++}`} id={id} dangerouslySetInnerHTML={{ __html: inner }} />
      );
    } else if (token.type === "table") {
      flush();
      out.push(<ReportTable key={`tb-${key++}`} raw={token.raw} />);
    } else {
      buffer += token.raw;
    }
  }
  flush();
  return out;
}

/** Tabela markdown + toggle pro gráfico, quando ela é graficável. */
function ReportTable({ raw }: { raw: string }) {
  const html = useMemo(() => marked.parse(raw) as string, [raw]);
  const chart = useMemo(() => {
    const [parsed] = parseMarkdownTables(raw);
    return parsed ? chartableTable(parsed) : null;
  }, [raw]);
  const [view, setView] = useState<"table" | "chart">("table");

  if (!chart) {
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  }

  return (
    <div className="report-table-block">
      <div className="report-table-toolbar">
        <div className="report-seg" role="tablist" aria-label="Visualização">
          <button
            type="button"
            role="tab"
            aria-selected={view === "table"}
            className={view === "table" ? "is-active" : ""}
            onClick={() => setView("table")}
          >
            Tabela
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "chart"}
            className={view === "chart" ? "is-active" : ""}
            onClick={() => setView("chart")}
          >
            Gráfico
          </button>
        </div>
      </div>
      {view === "table" ? (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <ReportChart table={chart} />
      )}
    </div>
  );
}
