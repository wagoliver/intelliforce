"use client";
/* eslint-disable */
// @ts-nocheck

import { Svg } from "../_components/agent-icons";
import { useAgent } from "../_components/agent-context";

export default function SkillPage() {
  const {
    role, setRole,
    goal, setGoal,
    constraints, setConstraints,
    outputSchema, setOutputSchema,
    examples, setExamples,
  } = useAgent();

  return (
    <div className="cap-pane">
      <div className="cap-pane-head">
        <h2 className="cap-pane-title">Skill</h2>
        <p className="cap-pane-desc">Describe how this agent thinks and what it returns. Each field is sent to the model as part of the system prompt at runtime.</p>
      </div>

      <div className="skill-block">
        <div className="skill-label-row">
          <span className="skill-label">Role</span>
          <span className="skill-counter">{role.length} chars</span>
        </div>
        <textarea className="code-area" value={role} onChange={e => setRole(e.target.value)} style={{ minHeight: 60 }} />
      </div>

      <div className="skill-block">
        <div className="skill-label-row">
          <span className="skill-label">Goal</span>
          <span className="skill-counter">{goal.length} chars</span>
        </div>
        <textarea className="code-area" value={goal} onChange={e => setGoal(e.target.value)} style={{ minHeight: 80 }} />
      </div>

      <div className="skill-block">
        <div className="skill-label-row">
          <span className="skill-label">Constraints</span>
          <span className="skill-counter">{constraints.length} chars</span>
        </div>
        <textarea className="code-area" value={constraints} onChange={e => setConstraints(e.target.value)} style={{ minHeight: 100 }} />
      </div>

      <div className="skill-block">
        <div className="skill-label-row">
          <span className="skill-label">Output format · JSON schema</span>
          <span className="skill-counter">structured</span>
        </div>
        <textarea className="code-area" value={outputSchema} onChange={e => setOutputSchema(e.target.value)} style={{ minHeight: 130 }} />
      </div>

      <div className="skill-block">
        <div className="skill-label-row">
          <span className="skill-label">Few-shot examples</span>
          <span className="skill-counter">{examples.length} examples</span>
        </div>
        <div className="fewshot-list">
          {examples.map((ex: any, i: number) => (
            <div key={ex.id} className="fewshot">
              <div className="fewshot-row">
                <span className="fewshot-row-l">Input</span>
                <textarea value={ex.input} onChange={e => {
                  const next = [...examples]; next[i] = { ...ex, input: e.target.value }; setExamples(next);
                }} />
              </div>
              <div className="fewshot-row">
                <span className="fewshot-row-l">Expected output</span>
                <textarea value={ex.output} onChange={e => {
                  const next = [...examples]; next[i] = { ...ex, output: e.target.value }; setExamples(next);
                }} />
              </div>
              <div className="fewshot-actions">
                <button className="icon-btn" onClick={() => setExamples(examples.filter((x: any) => x.id !== ex.id))}>
                  <Svg name="trash" className="ico" />
                </button>
              </div>
            </div>
          ))}
          <button className="add-btn" onClick={() => setExamples([...examples, { id: "ex" + Date.now(), input: "", output: "" }])}>
            <Svg name="plus" className="ico" />
            Add example
          </button>
        </div>
      </div>
    </div>
  );
}
