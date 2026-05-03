"use client";
/* eslint-disable */
// @ts-nocheck

import { Svg } from "../_components/agent-icons";
import { useAgent } from "../_components/agent-context";

export default function GuardrailsPage() {
  const { guardrails, setGuardrails } = useAgent();

  return (
    <div className="cap-pane">
      <div className="cap-pane-head">
        <h2 className="cap-pane-title">Guardrails</h2>
        <p className="cap-pane-desc">Plain-language rules enforced at runtime. The agent will refuse, escalate, or modify behavior when a rule matches.</p>
      </div>
      <div className="guardrail-list">
        {guardrails.map((g: any, i: number) => (
          <div key={g.id} className="guardrail">
            <span className="guardrail-num">R{i + 1}</span>
            <input className="guardrail-text" value={g.text} onChange={e => {
              const next = [...guardrails]; next[i] = { ...g, text: e.target.value }; setGuardrails(next);
            }} />
            <button className="icon-btn" onClick={() => setGuardrails(guardrails.filter((x: any) => x.id !== g.id))}>
              <Svg name="trash" className="ico" />
            </button>
          </div>
        ))}
        <button className="add-btn" onClick={() => setGuardrails([...guardrails, { id: "g" + Date.now(), text: "" }])}>
          <Svg name="plus" className="ico" />
          Add rule
        </button>
      </div>
    </div>
  );
}
