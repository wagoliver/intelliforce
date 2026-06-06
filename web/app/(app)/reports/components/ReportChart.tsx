"use client";

import type { ChartableTable } from "@/lib/reports/tables";

// Paleta temática — usa os tokens RGB do globals.css ("88 47 232" → rgb(...)).
const PALETTE = [
  "rgb(var(--accent))",
  "rgb(var(--success))",
  "rgb(var(--warning))",
  "rgb(var(--danger))",
  "rgb(99 102 241)",
  "rgb(14 165 233)",
];

function formatValue(v: number, unit: string): string {
  if (!Number.isFinite(v)) return "—";
  const n = Number.isInteger(v) ? v.toLocaleString("pt-BR") : v.toFixed(1).replace(".", ",");
  if (unit === "%") return `${n}%`;
  if (unit === "R$") return `R$ ${n}`;
  return n;
}

/**
 * Mini gráfico de barras horizontais (SVG puro, sem lib) derivado de uma tabela
 * markdown. Cada coluna numérica vira uma série com cor própria, normalizada
 * pelo seu próprio máximo (comparável entre linhas da mesma métrica).
 */
export function ReportChart({ table }: { table: ChartableTable }) {
  const { rows, labelIndex, numeric } = table;

  const W = 640;
  const LABEL_W = 200;
  const PAD_R = 64; // espaço pro valor à direita
  const barH = 13;
  const barGap = 4;
  const groupGap = 12;
  const top = numeric.length > 1 ? 26 : 8; // espaço pra legenda

  const groupH = numeric.length * barH + (numeric.length - 1) * barGap;
  const H = top + rows.length * (groupH + groupGap);
  const plotW = W - LABEL_W - PAD_R;

  // Máximo por coluna (>0 pra evitar divisão por zero).
  const maxByCol = numeric.map((col) =>
    Math.max(1, ...col.values.filter((v) => Number.isFinite(v)).map((v) => Math.abs(v)))
  );

  return (
    <div className="report-chart">
      {numeric.length > 1 && (
        <div className="report-chart-legend">
          {numeric.map((col, ci) => (
            <span key={col.index} className="report-chart-legend-item">
              <span
                className="report-chart-swatch"
                style={{ background: PALETTE[ci % PALETTE.length] }}
              />
              {col.label}
            </span>
          ))}
        </div>
      )}
      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Gráfico da tabela"
        preserveAspectRatio="xMinYMin meet"
      >
        {rows.map((row, ri) => {
          const gy = top + ri * (groupH + groupGap);
          const label = row[labelIndex] ?? "";
          return (
            <g key={ri}>
              <text
                x={LABEL_W - 10}
                y={gy + groupH / 2}
                textAnchor="end"
                dominantBaseline="middle"
                className="report-chart-label"
              >
                {label.length > 26 ? `${label.slice(0, 25)}…` : label}
              </text>
              {numeric.map((col, ci) => {
                const v = col.values[ri];
                const by = gy + ci * (barH + barGap);
                const w = Number.isFinite(v) ? (Math.abs(v) / maxByCol[ci]) * plotW : 0;
                const color = PALETTE[ci % PALETTE.length];
                return (
                  <g key={col.index}>
                    <rect
                      x={LABEL_W}
                      y={by}
                      width={Math.max(w, Number.isFinite(v) ? 2 : 0)}
                      height={barH}
                      rx={2}
                      fill={color}
                      opacity={0.9}
                    />
                    <text
                      x={LABEL_W + Math.max(w, 2) + 6}
                      y={by + barH / 2}
                      dominantBaseline="middle"
                      className="report-chart-value"
                    >
                      {formatValue(v, col.unit)}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
