// Parsing das tabelas markdown (GFM) do relatório + detecção de colunas
// numéricas, para enriquecer com mini-gráficos SVG. Best-effort e defensivo:
// na dúvida, não graficar.

export interface ParsedTable {
  header: string[];
  rows: string[][];
}

export interface NumericColumn {
  /** Índice da coluna no header. */
  index: number;
  /** Rótulo da coluna. */
  label: string;
  /** Valores numéricos por linha (NaN onde não parseável). */
  values: number[];
  /** Sufixo detectado ("%", "R$", "") para formatar o eixo. */
  unit: string;
}

export interface ChartableTable extends ParsedTable {
  /** Índice da coluna usada como rótulo (categórica). */
  labelIndex: number;
  /** Colunas numéricas graficáveis. */
  numeric: NumericColumn[];
}

const MAX_CHART_ROWS = 12;

/** Quebra uma linha `| a | b |` em células, tolerando pipes escapados. */
function splitRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, "|").trim());
}

/** Uma linha é separadora GFM se só tem `-`, `:`, espaços e pipes. */
function isSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/.test(line);
}

/** Extrai todas as tabelas GFM do markdown (fora de blocos de código). */
export function parseMarkdownTables(md: string): ParsedTable[] {
  const lines = (md ?? "").split("\n");
  const tables: ParsedTable[] = [];
  let inFence = false;
  let fence = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = line.trim().match(/^(```|~~~)/);
    if (fenceMatch) {
      if (!inFence) {
        inFence = true;
        fence = fenceMatch[1];
      } else if (line.trim().startsWith(fence)) {
        inFence = false;
      }
      continue;
    }
    if (inFence) continue;

    // Cabeçalho seguido de separador = início de tabela.
    if (line.includes("|") && i + 1 < lines.length && isSeparator(lines[i + 1])) {
      const header = splitRow(line);
      const rows: string[][] = [];
      let j = i + 2;
      for (; j < lines.length; j++) {
        const r = lines[j];
        if (!r.includes("|") || !r.trim()) break;
        const cells = splitRow(r);
        // Normaliza largura ao header.
        while (cells.length < header.length) cells.push("");
        rows.push(cells.slice(0, header.length));
      }
      if (rows.length > 0) tables.push({ header, rows });
      i = j - 1;
    }
  }
  return tables;
}

/** Converte uma célula em número, detectando %, moeda e separadores PT-BR. */
export function parseCell(raw: string): { value: number; unit: string } {
  const cell = (raw ?? "").trim();
  let unit = "";
  if (/%/.test(cell)) unit = "%";
  else if (/r\$|\$/i.test(cell)) unit = "R$";

  // Mantém só dígitos, separadores e sinal.
  let num = cell.replace(/[^\d,.\-]/g, "");
  if (!num || !/\d/.test(num)) return { value: NaN, unit };

  // PT-BR: "1.234,56" → vírgula decimal. Se há vírgula, ela é o decimal.
  if (num.includes(",")) {
    num = num.replace(/\./g, "").replace(",", ".");
  }
  const value = Number(num);
  return { value: Number.isFinite(value) ? value : NaN, unit };
}

/**
 * Decide se uma tabela é graficável e devolve as colunas numéricas.
 * Critérios: ≤ MAX_CHART_ROWS linhas, uma coluna de rótulo (a primeira não-
 * numérica) e ≥1 coluna numérica com a maioria das células parseáveis.
 */
export function chartableTable(t: ParsedTable): ChartableTable | null {
  if (t.rows.length === 0 || t.rows.length > MAX_CHART_ROWS) return null;
  if (t.header.length < 2) return null;

  const cols = t.header.length;
  const numeric: NumericColumn[] = [];
  let labelIndex = -1;

  for (let c = 0; c < cols; c++) {
    const parsed = t.rows.map((row) => parseCell(row[c] ?? ""));
    const values = parsed.map((p) => p.value);
    const ok = values.filter((v) => Number.isFinite(v)).length;
    const ratio = ok / t.rows.length;

    if (ratio >= 0.6) {
      const unit = parsed.find((p) => p.unit)?.unit ?? "";
      numeric.push({ index: c, label: t.header[c] ?? `Col ${c + 1}`, values, unit });
    } else if (labelIndex === -1) {
      labelIndex = c;
    }
  }

  if (labelIndex === -1 || numeric.length === 0) return null;
  // Não graficar se TODAS as colunas viraram numéricas (sem rótulo categórico).
  if (numeric.length >= cols) return null;

  return { ...t, labelIndex, numeric };
}
