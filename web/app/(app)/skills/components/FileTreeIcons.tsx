"use client";

/**
 * Ícones SVG custom pro file tree da /skills.
 *
 * Princípios de design:
 *  - viewBox 24x24 (renderizam crisp em qualquer escala)
 *  - Gradient verde-escuro → verde-claro com profundidade (depth shadow + highlight)
 *  - Stroke sutil pra borda definida em fundo dark
 *  - IDs de gradient únicos por instância (evita colisão quando vários ícones
 *    do mesmo tipo aparecem na mesma página)
 */

import { useId } from "react";

type IconProps = {
  size?: number;
  className?: string;
  glow?: boolean;
};

/* -------------------------------------------------------------------------- */
/* Folder closed — pasta padrão                                               */
/* -------------------------------------------------------------------------- */

export function FolderClosedIcon({ size = 20, className, glow = false }: IconProps) {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={glow ? { filter: `drop-shadow(0 0 6px oklch(0.78 0.18 152 / 0.5))` } : undefined}
    >
      <defs>
        <linearGradient id={`fld-body-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.72 0.16 152)" stopOpacity="1" />
          <stop offset="100%" stopColor="oklch(0.42 0.14 152)" stopOpacity="1" />
        </linearGradient>
        <linearGradient id={`fld-tab-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.82 0.15 152)" />
          <stop offset="100%" stopColor="oklch(0.65 0.17 152)" />
        </linearGradient>
        <linearGradient id={`fld-edge-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="oklch(0.92 0.12 152)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="oklch(0.92 0.12 152)" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      {/* tab traseira */}
      <path
        d="M3 7 Q3 5.5 4.5 5.5 L9.5 5.5 L11.5 7.5 L20 7.5 Q21.5 7.5 21.5 9 L21.5 10 L2.5 10 L2.5 7 Z"
        fill={`url(#fld-tab-${id})`}
      />
      {/* corpo principal */}
      <path
        d="M2.5 9 L21.5 9 L21.5 18.5 Q21.5 20 20 20 L4 20 Q2.5 20 2.5 18.5 Z"
        fill={`url(#fld-body-${id})`}
      />
      {/* highlight superior — simula light hit */}
      <path
        d="M2.5 9 L21.5 9"
        stroke={`url(#fld-edge-${id})`}
        strokeWidth="0.8"
        fill="none"
      />
      {/* sombra interna sutil na lateral direita */}
      <path
        d="M21.4 9.2 L21.4 19.5"
        stroke="oklch(0.30 0.10 152)"
        strokeWidth="0.5"
        strokeOpacity="0.4"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Folder open — pasta expandida                                              */
/* -------------------------------------------------------------------------- */

export function FolderOpenIcon({ size = 20, className, glow = false }: IconProps) {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={glow ? { filter: `drop-shadow(0 0 8px oklch(0.78 0.18 152 / 0.6))` } : undefined}
    >
      <defs>
        <linearGradient id={`fldo-back-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.62 0.14 152)" />
          <stop offset="100%" stopColor="oklch(0.40 0.13 152)" />
        </linearGradient>
        <linearGradient id={`fldo-front-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.86 0.16 152)" stopOpacity="1" />
          <stop offset="50%" stopColor="oklch(0.72 0.17 152)" stopOpacity="1" />
          <stop offset="100%" stopColor="oklch(0.55 0.18 152)" stopOpacity="1" />
        </linearGradient>
        <linearGradient id={`fldo-edge-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="oklch(0.95 0.10 152)" stopOpacity="0.65" />
          <stop offset="100%" stopColor="oklch(0.95 0.10 152)" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      {/* parte traseira (tab + topo da pasta) */}
      <path
        d="M3 7 Q3 5.5 4.5 5.5 L9.5 5.5 L11.5 7.5 L20 7.5 Q21.5 7.5 21.5 9 L21.5 11.5 L2.5 11.5 L2.5 7 Z"
        fill={`url(#fldo-back-${id})`}
      />
      {/* parte frontal — papel saindo (efeito open) */}
      <path
        d="M2.5 11 L4.2 19.2 Q4.4 20 5.4 20 L19.6 20 Q20.6 20 20.8 19.2 L22.5 11 Z"
        fill={`url(#fldo-front-${id})`}
      />
      {/* highlight no topo da parte frontal */}
      <path
        d="M2.5 11 L22.5 11"
        stroke={`url(#fldo-edge-${id})`}
        strokeWidth="0.9"
        fill="none"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Folder empty — pasta vazia, mais clara/wireframe                           */
/* -------------------------------------------------------------------------- */

export function FolderEmptyIcon({ size = 20, className }: IconProps) {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id={`flde-body-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.40 0.06 220)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="oklch(0.28 0.04 220)" stopOpacity="0.4" />
        </linearGradient>
      </defs>
      {/* contorno tracejado */}
      <path
        d="M3 7 Q3 5.5 4.5 5.5 L9.5 5.5 L11.5 7.5 L20 7.5 Q21.5 7.5 21.5 9 L21.5 18.5 Q21.5 20 20 20 L4 20 Q2.5 20 2.5 18.5 L2.5 7 Z"
        fill={`url(#flde-body-${id})`}
        stroke="oklch(0.55 0.05 220)"
        strokeWidth="1"
        strokeDasharray="2.5 2"
        strokeOpacity="0.7"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* File markdown — documento com linhas de conteúdo + dobra no canto          */
/* -------------------------------------------------------------------------- */

export function FileMarkdownIcon({ size = 18, className, glow = false }: IconProps) {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={glow ? { filter: `drop-shadow(0 0 5px oklch(0.78 0.18 152 / 0.5))` } : undefined}
    >
      <defs>
        <linearGradient id={`fm-body-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.32 0.04 250)" />
          <stop offset="100%" stopColor="oklch(0.20 0.02 250)" />
        </linearGradient>
        <linearGradient id={`fm-fold-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.55 0.08 250)" />
          <stop offset="100%" stopColor="oklch(0.40 0.06 250)" />
        </linearGradient>
      </defs>
      {/* corpo do documento */}
      <path
        d="M5 3 L14 3 L20 9 L20 21 L5 21 Z"
        fill={`url(#fm-body-${id})`}
        stroke="oklch(0.55 0.10 152)"
        strokeWidth="1"
        strokeOpacity="0.55"
      />
      {/* dobra no canto superior direito */}
      <path
        d="M14 3 L14 9 L20 9 Z"
        fill={`url(#fm-fold-${id})`}
        stroke="oklch(0.55 0.10 152)"
        strokeWidth="1"
        strokeOpacity="0.4"
      />
      {/* "M↓" — marcador markdown */}
      <path
        d="M7.5 14.5 L7.5 17.5 M7.5 14.5 L9 16 L10.5 14.5 M10.5 14.5 L10.5 17.5"
        stroke="oklch(0.78 0.18 152)"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M14 14.5 L14 17.5 M12.7 16.2 L14 17.5 L15.3 16.2"
        stroke="oklch(0.78 0.18 152)"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* File python — documento com marca .py em azul/amarelo (cor da linguagem)   */
/* -------------------------------------------------------------------------- */

export function FilePythonIcon({ size = 18, className, glow = false }: IconProps) {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={glow ? { filter: `drop-shadow(0 0 5px oklch(0.78 0.13 215 / 0.5))` } : undefined}
    >
      <defs>
        <linearGradient id={`fpy-body-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.32 0.04 250)" />
          <stop offset="100%" stopColor="oklch(0.20 0.02 250)" />
        </linearGradient>
        <linearGradient id={`fpy-fold-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.55 0.08 250)" />
          <stop offset="100%" stopColor="oklch(0.40 0.06 250)" />
        </linearGradient>
        {/* Cores oficiais da logo Python: azul + amarelo */}
        <linearGradient id={`fpy-blue-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.62 0.14 240)" />
          <stop offset="100%" stopColor="oklch(0.45 0.16 250)" />
        </linearGradient>
        <linearGradient id={`fpy-yellow-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.86 0.16 95)" />
          <stop offset="100%" stopColor="oklch(0.72 0.18 80)" />
        </linearGradient>
      </defs>
      {/* corpo do documento */}
      <path
        d="M5 3 L14 3 L20 9 L20 21 L5 21 Z"
        fill={`url(#fpy-body-${id})`}
        stroke="oklch(0.55 0.10 215)"
        strokeWidth="1"
        strokeOpacity="0.55"
      />
      {/* dobra no canto superior direito */}
      <path
        d="M14 3 L14 9 L20 9 Z"
        fill={`url(#fpy-fold-${id})`}
        stroke="oklch(0.55 0.10 215)"
        strokeWidth="1"
        strokeOpacity="0.4"
      />
      {/* mini-logo Python (duas serpentes entrelaçadas — abstraído em 2 retângulos arredondados) */}
      <rect x="7.5" y="13" width="6" height="3.5" rx="1.2" fill={`url(#fpy-blue-${id})`} />
      <rect x="10.5" y="15.5" width="6" height="3.5" rx="1.2" fill={`url(#fpy-yellow-${id})`} />
      <circle cx="9" cy="14.4" r="0.55" fill="oklch(0.95 0.02 250)" />
      <circle cx="15" cy="17.1" r="0.55" fill="oklch(0.20 0.05 80)" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Lock badge — overlay pra arquivos/pastas imutáveis (seeds)                  */
/* -------------------------------------------------------------------------- */

export function LockBadge({ size = 11 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Imutável"
    >
      <circle cx="7" cy="7" r="6.5" fill="oklch(0.16 0.012 255)" stroke="oklch(0.78 0.18 152)" strokeWidth="0.8" />
      <rect x="4" y="6" width="6" height="4.5" rx="0.7" fill="oklch(0.78 0.18 152)" />
      <path
        d="M5 6 L5 4.6 Q5 3.2 7 3.2 Q9 3.2 9 4.6 L9 6"
        fill="none"
        stroke="oklch(0.78 0.18 152)"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Chevron — pra expand/collapse                                              */
/* -------------------------------------------------------------------------- */

export function ChevronIcon({ size = 12, expanded = false }: { size?: number; expanded?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        transition: "transform 220ms cubic-bezier(0.32, 0.72, 0, 1)",
        transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
      }}
    >
      <path
        d="M6 4 L10 8 L6 12"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
