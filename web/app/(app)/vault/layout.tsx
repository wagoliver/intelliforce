import type { ReactNode } from "react";

import "./vault.css";

export default function VaultLayout({ children }: { children: ReactNode }) {
  return (
    <div className="vault-canvas">
      <div className="vault-mesh" aria-hidden="true" />
      <div className="vault-content">{children}</div>
    </div>
  );
}
