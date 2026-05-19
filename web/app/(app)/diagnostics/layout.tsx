import type { ReactNode } from "react";

import { NeuralRibbons } from "@/app/(app)/skills/components/NeuralRibbons";

import "./diagnostics.css";

export default function DiagnosticsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="diagnostics-canvas">
      <div className="diagnostics-mesh" aria-hidden="true" />
      <NeuralRibbons className="diagnostics-neural-ribbons" dimmed />
      {children}
    </div>
  );
}
