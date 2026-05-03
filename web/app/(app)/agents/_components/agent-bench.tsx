"use client";
/* eslint-disable */
// @ts-nocheck

import { Svg } from "./agent-icons";
import { useAgent } from "./agent-context";

export function AgentBench() {
  const {
    benchOpen, setBenchOpen,
    benchInput, setBenchInput,
    benchResult, running, history,
    runBench,
  } = useAgent();

  return (
    <aside className="cap-bench">
      <div className="cap-bench-head">
        <span className="cap-bench-title">{benchOpen ? "Test bench" : "Bench"}</span>
        <button className="cap-bench-toggle" onClick={() => setBenchOpen(!benchOpen)} title={benchOpen ? "Collapse" : "Expand"}>
          <Svg name={benchOpen ? "collapse" : "expand"} className="ico" />
        </button>
      </div>
      {benchOpen && (
        <div className="cap-bench-body">
          <div className="bench-section">
            <span className="bench-section-l">Sample input</span>
            <textarea className="bench-input" value={benchInput} onChange={e => setBenchInput(e.target.value)} />
          </div>
          <button className="bench-run" onClick={runBench} disabled={running}>
            <Svg name="play" className="ico" />
            {running ? "Running…" : "Run preview"}
          </button>

          <div className="bench-section">
            <span className="bench-section-l">Output</span>
            <div className="bench-output">
              {!benchResult && !running && <div className="bench-output-empty">Run the agent to see trace and final output.</div>}
              {running && <div className="bench-output-empty">Executing…</div>}
              {benchResult && (
                <>
                  <div className="bench-trace">
                    {benchResult.trace.map((t: any, i: number) => (
                      <div key={i} className="bench-trace-line">
                        <span className="bench-trace-mark">▸</span>
                        <span className="bench-trace-tag">{t.tag}</span>
                        <span className="bench-trace-text">{t.text}</span>
                      </div>
                    ))}
                  </div>
                  <pre className="bench-output-final">{benchResult.final}</pre>
                </>
              )}
            </div>
          </div>

          <div className="bench-section">
            <span className="bench-section-l">History</span>
            <div className="bench-history">
              {history.map((h: any) => (
                <div key={h.id} className="bench-history-row">
                  <span className={`bench-history-dot ${h.ok ? "ok" : "err"}`} />
                  <span>{h.summary}</span>
                  <span>{h.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
