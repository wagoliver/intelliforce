import type { ReactNode } from "react";

import "./skills.css";

export default function SkillsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="skills-canvas">
      <div className="skills-mesh" aria-hidden="true" />
      {children}
    </div>
  );
}
