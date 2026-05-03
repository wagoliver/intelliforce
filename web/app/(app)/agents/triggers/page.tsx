"use client";
/* eslint-disable */
// @ts-nocheck

import { Svg } from "../_components/agent-icons";
import { useAgent } from "../_components/agent-context";

const TRIGGERS = [
  { id: "webhook", name: "Webhook", icon: "webhook", desc: "External systems POST to a URL we generate." },
  { id: "queue", name: "Queue", icon: "queue", desc: "Pull from an internal task queue (default for Finance)." },
  { id: "schedule", name: "Schedule", icon: "cron", desc: "Run on a cron schedule, e.g. every 15 minutes." },
  { id: "event", name: "Event", icon: "event", desc: "React to events emitted by other activities." },
];

export default function TriggersPage() {
  const { trigger, setTrigger } = useAgent();

  return (
    <div className="cap-pane">
      <div className="cap-pane-head">
        <h2 className="cap-pane-title">Triggers</h2>
        <p className="cap-pane-desc">How this activity is invoked. Choose one — you can combine triggers later via routing rules.</p>
      </div>
      <div className="trigger-grid">
        {TRIGGERS.map(t => (
          <div key={t.id} className={`trigger-card ${trigger === t.id ? "active" : ""}`} onClick={() => setTrigger(t.id)}>
            <div className="trigger-icon"><Svg name={t.icon} className="ico" /></div>
            <div>
              <div className="trigger-name">{t.name}</div>
              <div className="trigger-desc">{t.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {trigger === "webhook" && (
        <div className="trigger-config">
          <div className="trigger-config-l">Generated webhook URL</div>
          <div className="webhook-url">
            <span className="webhook-url-text">https://api.intelliforce.io/v1/webhooks/finance/invoice-validator/whk_8a9f2e</span>
            <button className="webhook-copy"><Svg name="copy" className="ico" style={{ width: 10, height: 10, verticalAlign: "middle", marginRight: 4 }} />Copy</button>
          </div>
        </div>
      )}
      {trigger === "queue" && (
        <div className="trigger-config">
          <div className="trigger-config-l">Queue source</div>
          <select className="input" defaultValue="ap_inbound">
            <option value="ap_inbound">ap_inbound (Accounts Payable)</option>
            <option value="finance_general">finance_general</option>
          </select>
        </div>
      )}
      {trigger === "schedule" && (
        <div className="trigger-config">
          <div className="trigger-config-l">Cron expression</div>
          <input className="input" defaultValue="*/15 * * * *" />
          <span style={{ fontSize: 11, color: "var(--text-subtle)", marginTop: 6, display: "block" }}>Every 15 minutes</span>
        </div>
      )}
      {trigger === "event" && (
        <div className="trigger-config">
          <div className="trigger-config-l">Listen to event</div>
          <select className="input" defaultValue="invoice.received">
            <option value="invoice.received">invoice.received</option>
            <option value="po.created">po.created</option>
          </select>
        </div>
      )}
    </div>
  );
}
