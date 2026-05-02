// IntelliForce logo — 6 abstract geometric marks
// All built on the same accent (oklch(0.42 0.13 265)) — institutional indigo
// Each is a "mark only" symbol, designed to scale from 16px → 96px+

const ACCENT = "oklch(0.42 0.13 265)";
const ACCENT_SOFT = "oklch(0.78 0.10 265)";
const ACCENT_DEEP = "oklch(0.30 0.13 265)";

// 1) Stacked Bars — three weighted horizontal bars suggesting layered force / capacity
function LogoStackedBars({ size = 96 }) {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-label="IntelliForce">
      <rect x="8" y="14" width="48" height="8" rx="1.5" fill={ACCENT} />
      <rect x="8" y="28" width="36" height="8" rx="1.5" fill={ACCENT} opacity="0.72" />
      <rect x="8" y="42" width="22" height="8" rx="1.5" fill={ACCENT} opacity="0.45" />
    </svg>
  );
}

// 2) Notched Square — solid square with a precise inner notch removed; single-letter "I" implied
function LogoNotchedSquare() {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-label="IntelliForce">
      <path
        d="M10 10 H54 V54 H10 Z M22 22 V42 H42 V22 Z"
        fill={ACCENT}
        fillRule="evenodd"
      />
    </svg>
  );
}

// 3) Offset Squares — two overlapping squares, classic geometric monogram (I + F implied)
function LogoOffsetSquares() {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-label="IntelliForce">
      <rect x="10" y="10" width="32" height="32" fill={ACCENT} opacity="0.32" />
      <rect x="22" y="22" width="32" height="32" fill={ACCENT} />
    </svg>
  );
}

// 4) Triadic Stack — three squares stacked in stair pattern (ascending force)
function LogoTriadic() {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-label="IntelliForce">
      <rect x="8" y="40" width="16" height="16" fill={ACCENT} opacity="0.40" />
      <rect x="24" y="24" width="16" height="16" fill={ACCENT} opacity="0.70" />
      <rect x="40" y="8" width="16" height="16" fill={ACCENT} />
    </svg>
  );
}

// 5) Cut Disc — circle with a precise diagonal slice; suggests motion + precision
function LogoCutDisc() {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-label="IntelliForce">
      <defs>
        <clipPath id="cutDiscClip">
          <circle cx="32" cy="32" r="22" />
        </clipPath>
      </defs>
      <g clipPath="url(#cutDiscClip)">
        <rect x="0" y="0" width="64" height="64" fill={ACCENT} />
        <rect x="32" y="0" width="32" height="64" fill={ACCENT} opacity="0.45" transform="rotate(-18 32 32)" />
      </g>
      <circle cx="32" cy="32" r="22" fill="none" stroke={ACCENT} strokeWidth="0" />
    </svg>
  );
}

// 6) Aperture — precise 4-blade aperture / iris, suggesting focus + force
function LogoAperture() {
  const blades = [0, 90, 180, 270];
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-label="IntelliForce">
      <g transform="translate(32 32)">
        {blades.map((deg, i) => (
          <path
            key={i}
            d="M 0 -22 L 16 -6 L 0 0 L -16 -6 Z"
            fill={ACCENT}
            opacity={i % 2 === 0 ? 1 : 0.55}
            transform={`rotate(${deg})`}
          />
        ))}
      </g>
    </svg>
  );
}

const LOGOS = [
  {
    id: "stacked-bars",
    name: "Stacked Bars",
    desc: "Three weighted bars — capacity, layered force, descending priority.",
    Component: LogoStackedBars,
  },
  {
    id: "notched-square",
    name: "Notched Square",
    desc: "Solid frame with precise inner cut — institutional, monogram-like.",
    Component: LogoNotchedSquare,
  },
  {
    id: "offset-squares",
    name: "Offset Squares",
    desc: "Two overlapping squares — classic geometric monogram, I + F implied.",
    Component: LogoOffsetSquares,
  },
  {
    id: "triadic",
    name: "Triadic Stack",
    desc: "Stair of three squares — ascending force, momentum without arrows.",
    Component: LogoTriadic,
  },
  {
    id: "cut-disc",
    name: "Cut Disc",
    desc: "Circle bisected by a precise plane — motion meeting precision.",
    Component: LogoCutDisc,
  },
  {
    id: "aperture",
    name: "Aperture",
    desc: "Four-blade iris — focus, alignment, controlled power.",
    Component: LogoAperture,
  },
];

window.LOGOS = LOGOS;
