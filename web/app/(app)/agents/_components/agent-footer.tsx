"use client";
/* eslint-disable */
// @ts-nocheck

export function AgentFooter() {
  return (
    <div className="cap-footer">
      <div className="cap-footer-status dirty">
        <span className="dot" />
        Draft · Unsaved changes
      </div>
      <div className="cap-footer-actions">
        <button className="btn-secondary" type="button">Save draft</button>
        <button className="btn-primary" type="button">Deploy capability</button>
      </div>
    </div>
  );
}
