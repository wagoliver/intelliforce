// Notched Square — 12 refinements across geometry / weight / personality

const ACCENT = "oklch(0.42 0.13 265)";
const ACCENT_SOFT = "oklch(0.78 0.10 265)";
const ACCENT_DEEP = "oklch(0.30 0.13 265)";

// Baseline (the one selected) — for reference
function NS_Baseline() {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 10 H54 V54 H10 Z M22 22 V42 H42 V22 Z" fill={ACCENT} fillRule="evenodd" />
    </svg>
  );
}

// 1) Tighter notch — thicker frame, smaller cutout (more solid, more institutional)
function NS_TightNotch() {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 10 H54 V54 H10 Z M26 26 V38 H38 V26 Z" fill={ACCENT} fillRule="evenodd" />
    </svg>
  );
}

// 2) Wide notch — thinner frame, more breathing room (more architectural)
function NS_WideNotch() {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 10 H54 V54 H10 Z M18 18 V46 H46 V18 Z" fill={ACCENT} fillRule="evenodd" />
    </svg>
  );
}

// 3) Soft corners — same geometry, 2px radius (more contemporary, friendlier)
function NS_SoftCorners() {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 10 H52 A2 2 0 0 1 54 12 V52 A2 2 0 0 1 52 54 H12 A2 2 0 0 1 10 52 V12 A2 2 0 0 1 12 10 Z M24 22 A2 2 0 0 0 22 24 V40 A2 2 0 0 0 24 42 H40 A2 2 0 0 0 42 40 V24 A2 2 0 0 0 40 22 Z"
        fill={ACCENT}
        fillRule="evenodd"
      />
    </svg>
  );
}

// 4) Off-center notch — cutout shifted to lower-right, breaks symmetry (more dynamic)
function NS_OffsetNotch() {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 10 H54 V54 H10 Z M26 26 V44 H44 V26 Z" fill={ACCENT} fillRule="evenodd" />
    </svg>
  );
}

// 5) Two-tone — outer frame solid, inner notch filled with soft tone (depth without losing form)
function NS_TwoTone() {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="10" width="44" height="44" fill={ACCENT} />
      <rect x="22" y="22" width="20" height="20" fill={ACCENT_SOFT} />
    </svg>
  );
}

// 6) Outline only — thin stroke, no fill (more delicate, technical)
function NS_Outline() {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none">
      <rect x="11" y="11" width="42" height="42" stroke={ACCENT} strokeWidth="2.5" />
      <rect x="23" y="23" width="18" height="18" stroke={ACCENT} strokeWidth="2.5" />
    </svg>
  );
}

// 7) Open frame — top edge of inner notch missing (suggests "I" letter, opening)
function NS_OpenTop() {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M10 10 H54 V54 H10 Z M22 22 V42 H42 V22 Z M26 18 H38 V22 H26 Z"
        fill={ACCENT}
        fillRule="evenodd"
      />
    </svg>
  );
}

// 8) Layered — frame + smaller inner solid square, like a target / focus
function NS_Layered() {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 10 H54 V54 H10 Z M22 22 V42 H42 V22 Z" fill={ACCENT} fillRule="evenodd" />
      <rect x="28" y="28" width="8" height="8" fill={ACCENT} />
    </svg>
  );
}

// 9) Asymmetric thickness — top + left thicker than bottom + right (suggests light source / weight)
function NS_AsymWeight() {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M10 10 H54 V54 H10 Z M22 22 V40 H40 V22 Z"
        fill={ACCENT}
        fillRule="evenodd"
      />
    </svg>
  );
}

// 10) Split frame — gap on right edge (suggests opening, throughput, flow)
function NS_SplitRight() {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M10 10 H54 V26 H42 V22 H22 V42 H42 V38 H54 V54 H10 Z"
        fill={ACCENT}
      />
    </svg>
  );
}

// 11) Diagonal notch — square with rotated inner cutout (more dynamic, force vector)
function NS_DiagonalNotch() {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 10 H54 V54 H10 Z" fill={ACCENT} />
      <rect x="32" y="14" width="20" height="20" fill="white" transform="rotate(45 32 32)" />
    </svg>
  );
}

// 12) Inverted — solid square with notch shape on outside corners (more sculptural)
function NS_Inverted() {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M10 10 H22 V22 H10 Z M42 10 H54 V22 H42 Z M10 42 H22 V54 H10 Z M42 42 H54 V54 H42 Z M22 22 H42 V42 H22 Z"
        fill={ACCENT}
      />
    </svg>
  );
}

const NOTCHED_VARIANTS = [
  { id: "baseline", name: "Baseline", desc: "The one you selected — equal frame, centered notch.", Component: NS_Baseline },
  { id: "tight", name: "Tight notch", desc: "Thicker frame, smaller cutout — more solid, more institutional.", Component: NS_TightNotch },
  { id: "wide", name: "Wide notch", desc: "Thinner frame, more breathing room — architectural, less heavy.", Component: NS_WideNotch },
  { id: "soft", name: "Soft corners", desc: "Same geometry with 2 px radius — contemporary, friendlier touch.", Component: NS_SoftCorners },
  { id: "offset", name: "Offset notch", desc: "Cutout shifted to lower-right — breaks symmetry, feels engineered.", Component: NS_OffsetNotch },
  { id: "twotone", name: "Two-tone", desc: "Solid outer, soft inner — depth without losing geometric form.", Component: NS_TwoTone },
  { id: "outline", name: "Outline only", desc: "Thin stroke version — delicate, technical, blueprint-like.", Component: NS_Outline },
  { id: "opentop", name: "Open top", desc: "Inner notch reads as 'I' — letterform meaning embedded.", Component: NS_OpenTop },
  { id: "layered", name: "Layered core", desc: "Inner core square — target, focal point, intentionality.", Component: NS_Layered },
  { id: "split", name: "Split right", desc: "Gap on right edge — throughput, flow, output.", Component: NS_SplitRight },
  { id: "diagonal", name: "Diagonal notch", desc: "Rotated inner cutout — force vector, motion.", Component: NS_DiagonalNotch },
  { id: "inverted", name: "Corner-cut", desc: "Negative space at corners — sculptural, modular.", Component: NS_Inverted },
];

window.NOTCHED_VARIANTS = NOTCHED_VARIANTS;
