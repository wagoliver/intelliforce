"use client";
/* eslint-disable */
// @ts-nocheck

import { Svg } from "../_components/agent-icons";
import { useAgent } from "../_components/agent-context";

export default function ToolsPage() {
  const { tools, setTools, newToolOpen, setNewToolOpen } = useAgent();

  return (
    <>
      <div className="cap-pane">
        <div className="cap-pane-head">
          <h2 className="cap-pane-title">Tools</h2>
          <p className="cap-pane-desc">Capabilities the agent can invoke at runtime. Enable existing tools or create a new one for this organization.</p>
        </div>
        <div className="tools-grid">
          {tools.map((t: any) => (
            <div key={t.id} className={`tool-card ${t.enabled ? "enabled" : ""}`}>
              <div className="tool-icon">
                <Svg name={t.id === "t1" ? "sql" : "web"} className="ico" />
              </div>
              <div className="tool-meta">
                <div className="tool-head">
                  <span className="tool-name">{t.name}</span>
                  <span className="tool-type">{t.type}</span>
                </div>
                <div className="tool-desc">{t.desc}</div>
              </div>
              <div className={`toggle ${t.enabled ? "on" : ""}`}
                onClick={() => setTools(tools.map((x: any) => x.id === t.id ? { ...x, enabled: !x.enabled } : x))}
              />
            </div>
          ))}
          <button className="create-tool-card" onClick={() => setNewToolOpen(true)}>
            <Svg name="plus" className="ico" />
            Create new tool
          </button>
        </div>
      </div>

      {newToolOpen && (
        <>
          <div className="drawer-backdrop" onClick={() => setNewToolOpen(false)} />
          <div className="drawer">
            <div className="drawer-head">
              <div>
                <h3 className="drawer-title">Create new tool</h3>
                <p className="drawer-sub">Define a reusable tool the org can attach to any agent. Configure connection details and parameters.</p>
              </div>
              <button className="drawer-close" onClick={() => setNewToolOpen(false)}><Svg name="close" className="ico" /></button>
            </div>
            <div className="drawer-body">
              <div className="tool-form">
                <div className="field">
                  <label className="field-label">Tool name</label>
                  <input className="input" placeholder="e.g. SAP read invoice" />
                </div>
                <div className="field">
                  <label className="field-label">Type</label>
                  <select className="input" defaultValue="rest">
                    <option value="rest">REST API</option>
                    <option value="sql">SQL</option>
                    <option value="function">Function (code)</option>
                    <option value="mcp">MCP server</option>
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">Description</label>
                  <textarea className="textarea" placeholder="What does this tool do? When should the agent use it?" />
                </div>
                <div className="field">
                  <label className="field-label">Endpoint / connection</label>
                  <input className="input" placeholder="https://… or connection string" />
                </div>
                <div className="field">
                  <label className="field-label">Authentication</label>
                  <select className="input" defaultValue="oauth">
                    <option value="oauth">OAuth 2.0</option>
                    <option value="bearer">Bearer token</option>
                    <option value="apikey">API key</option>
                    <option value="none">None</option>
                  </select>
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                  <button className="btn-secondary" onClick={() => setNewToolOpen(false)}>Cancel</button>
                  <button className="btn-primary" onClick={() => setNewToolOpen(false)}>Create tool</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
