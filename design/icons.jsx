// IntelliForce — icons + SSO buttons
const { useState } = React;

const Icon = {
  Mail: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2"/>
      <path d="m3 7 9 6 9-6"/>
    </svg>
  ),
  Lock: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="4" y="11" width="16" height="10" rx="2"/>
      <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
    </svg>
  ),
  Eye: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  EyeOff: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9.88 5.16A10.94 10.94 0 0 1 12 5c6.5 0 10 7 10 7a17.64 17.64 0 0 1-3.06 3.94"/>
      <path d="M6.61 6.61A17.91 17.91 0 0 0 2 12s3.5 7 10 7a10.94 10.94 0 0 0 5.39-1.39"/>
      <path d="m2 2 20 20"/>
      <path d="M9.5 9.5a3 3 0 0 0 4.24 4.24"/>
    </svg>
  ),
  Arrow: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 12h14"/>
      <path d="m13 6 6 6-6 6"/>
    </svg>
  ),
  Check: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 12l4 4 10-10"/>
    </svg>
  ),
  Back: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M19 12H5"/>
      <path d="m11 18-6-6 6-6"/>
    </svg>
  ),
  Shield: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6Z"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  ),
};

// Brand SSO marks (recognizable but not pixel-copies of trademarks)
const SSOMicrosoftIcon = (props) => (
  <svg viewBox="0 0 24 24" {...props}>
    <rect x="2" y="2" width="9" height="9" fill="#F25022"/>
    <rect x="13" y="2" width="9" height="9" fill="#7FBA00"/>
    <rect x="2" y="13" width="9" height="9" fill="#00A4EF"/>
    <rect x="13" y="13" width="9" height="9" fill="#FFB900"/>
  </svg>
);

const SSOGoogleIcon = (props) => (
  <svg viewBox="0 0 24 24" {...props}>
    <path fill="#4285F4" d="M21.6 12.23c0-.74-.07-1.45-.19-2.13H12v4.03h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.89-1.74 2.99-4.3 2.99-7.42Z"/>
    <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.61-2.43l-3.23-2.5c-.9.6-2.04.95-3.38.95-2.6 0-4.8-1.75-5.59-4.1H3.07v2.58A10 10 0 0 0 12 22Z"/>
    <path fill="#FBBC05" d="M6.41 13.92a6 6 0 0 1 0-3.84V7.5H3.07a10 10 0 0 0 0 9l3.34-2.58Z"/>
    <path fill="#EA4335" d="M12 5.96c1.47 0 2.78.5 3.82 1.49l2.86-2.86A10 10 0 0 0 3.07 7.5l3.34 2.58c.79-2.35 2.99-4.12 5.59-4.12Z"/>
  </svg>
);

const SSOSamlIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6Z"/>
    <path d="M9 12h6"/><path d="M12 9v6"/>
  </svg>
);

function SSOButton({ icon, label, meta, onClick }) {
  return (
    <button type="button" className="sso-btn" onClick={onClick}>
      {icon}
      <span className="sso-label">{label}</span>
      {meta && <span className="sso-meta">{meta}</span>}
    </button>
  );
}

Object.assign(window, { Icon, SSOMicrosoftIcon, SSOGoogleIcon, SSOSamlIcon, SSOButton });
