"use client";
/* eslint-disable */
// @ts-nocheck

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAgent } from "./agent-context";

const TABS = [
  { href: "/agents/skill",      label: "Skill",      key: "skill" },
  { href: "/agents/tools",      label: "Tools",      key: "tools" },
  { href: "/agents/knowledge",  label: "Knowledge",  key: "knowledge" },
  { href: "/agents/guardrails", label: "Guardrails", key: "guardrails" },
  { href: "/agents/triggers",   label: "Triggers",   key: "triggers" },
];

export function AgentTabs() {
  const pathname = usePathname();
  const { enabledTools, tools, knowledge, guardrails } = useAgent();

  function badge(key: string) {
    if (key === "tools") return <span className="count">{enabledTools.length}/{tools.length}</span>;
    if (key === "knowledge") return <span className="count">{knowledge.length}</span>;
    if (key === "guardrails") return <span className="count">{guardrails.length}</span>;
    return null;
  }

  return (
    <div className="cap-tabs">
      {TABS.map(t => {
        const active = pathname === t.href || pathname?.startsWith(t.href + "/");
        return (
          <Link key={t.key} href={t.href} className={`cap-tab ${active ? "active" : ""}`}>
            {t.label} {badge(t.key)}
          </Link>
        );
      })}
    </div>
  );
}
