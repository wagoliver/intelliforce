"use client";
/* eslint-disable */
// @ts-nocheck

import { D } from "./agent-data";
import { Svg } from "./agent-icons";
import { useAgent } from "./agent-context";

export function AgentTemplatesDrawer() {
  const { templatesOpen, setTemplatesOpen, applyTemplate } = useAgent();

  if (!templatesOpen) return null;

  return (
    <>
      <div className="drawer-backdrop" onClick={() => setTemplatesOpen(false)} />
      <div className="drawer">
        <div className="drawer-head">
          <div>
            <h3 className="drawer-title">Capability templates</h3>
            <p className="drawer-sub">Start from a pre-built capability and adapt it to this activity. Templates pre-fill skill, tools, and a starter set of guardrails.</p>
          </div>
          <button className="drawer-close" onClick={() => setTemplatesOpen(false)}><Svg name="close" className="ico" /></button>
        </div>
        <div className="drawer-body">
          {D.templates.map((tpl: any) => (
            <div key={tpl.id} className="template-card" onClick={() => applyTemplate(tpl)}>
              <div className="template-head">
                <span className="template-name">{tpl.name}</span>
                <span className="template-cat">{tpl.category}</span>
              </div>
              <div className="template-desc">{tpl.desc}</div>
              {tpl.tools.length > 0 && (
                <div className="template-tools">
                  Uses:
                  {tpl.tools.map((t: string) => <span key={t} className="template-tool-pill">{t}</span>)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
