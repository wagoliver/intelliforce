"use client";
/* eslint-disable */
// @ts-nocheck

import { Svg } from "../_components/agent-icons";
import { useAgent } from "../_components/agent-context";

export default function KnowledgePage() {
  const { knowledge, setKnowledge } = useAgent();

  return (
    <div className="cap-pane">
      <div className="cap-pane-head">
        <h2 className="cap-pane-title">Knowledge</h2>
        <p className="cap-pane-desc">Reference documents the agent retrieves from. Files are chunked, embedded, and indexed automatically.</p>
      </div>
      <div className="knowledge-drop">
        <Svg name="upload" className="ico" />
        <div><strong>Drop files here</strong> or pick from your library</div>
        <button className="upload-cta">
          <Svg name="upload" className="ico" style={{ width: 12, height: 12 }} />
          Upload files
        </button>
      </div>
      <div className="knowledge-list">
        {knowledge.map((k: any) => (
          <div key={k.id} className="knowledge-item">
            <div className="knowledge-icon"><Svg name="doc" className="ico" /></div>
            <div className="knowledge-meta">
              <span className="knowledge-name">{k.name}</span>
              <span className="knowledge-sub">{k.size}</span>
            </div>
            <span className="knowledge-tokens">{k.tokens} tokens</span>
            <button className="icon-btn" onClick={() => setKnowledge(knowledge.filter((x: any) => x.id !== k.id))}>
              <Svg name="trash" className="ico" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
