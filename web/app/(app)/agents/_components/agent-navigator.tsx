"use client";
/* eslint-disable */
// @ts-nocheck

import { D } from "./agent-data";
import { Svg } from "./agent-icons";
import { useAgent } from "./agent-context";

export function AgentNavigator() {
  const { filled, setTemplatesOpen } = useAgent();

  return (
    <aside className="cap-nav">
      <a className="cap-nav-back" href="/setup">
        <Svg name="back" className="ico" />
        Back to {D.activity.department}
      </a>

      <div className="cap-nav-crumb">
        {D.activity.department}<span className="sep">›</span>
        {D.activity.squad}<span className="sep">›</span>
        <span className="current">{D.activity.name}</span>
      </div>

      <div className="cap-nav-status">
        <span className="cap-nav-status-l">Status</span>
        <span className="cap-nav-status-v">{filled} of 5 configured</span>
        <div className="cap-nav-progress">
          {[0, 1, 2, 3, 4].map(i => <span key={i} className={`seg ${i < filled ? "done" : ""}`} />)}
        </div>
      </div>

      <div>
        <div className="cap-nav-section-l">Squad activities</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 6 }}>
          {D.activity.siblings.map((s: any) => (
            <a key={s.id} className={`cap-sibling ${s.id === D.activity.id ? "active" : ""}`} href="#">
              <span className="cap-sibling-skill">{s.skill}</span>
              <span className={`cap-sibling-name ${s.id === D.activity.id ? "" : "muted"}`}>{s.name}</span>
              <span className={`cap-sibling-status ${s.status}`} title={s.status} />
            </a>
          ))}
        </div>
      </div>

      <button className="cap-templates-btn" onClick={() => setTemplatesOpen(true)}>
        <Svg name="cap" className="ico" />
        Browse capability templates
      </button>
    </aside>
  );
}
