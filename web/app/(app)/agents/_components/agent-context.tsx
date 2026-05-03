"use client";
/* eslint-disable */
// @ts-nocheck

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { initialState, D } from "./agent-data";

type AgentCtx = ReturnType<typeof useAgentState>;

function useAgentState() {
  // Skill
  const [role, setRole] = useState(initialState.role);
  const [goal, setGoal] = useState(initialState.goal);
  const [constraints, setConstraints] = useState(initialState.constraints);
  const [outputSchema, setOutputSchema] = useState(initialState.outputSchema);
  const [examples, setExamples] = useState(initialState.examples);

  // Tools
  const [tools, setTools] = useState(D.tools);

  // Knowledge
  const [knowledge, setKnowledge] = useState(initialState.knowledge);

  // Guardrails
  const [guardrails, setGuardrails] = useState(initialState.guardrails);

  // Trigger
  const [trigger, setTrigger] = useState(initialState.trigger);

  // Bench
  const [benchOpen, setBenchOpen] = useState(true);
  const [benchInput, setBenchInput] = useState(initialState.benchInput);
  const [benchResult, setBenchResult] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState(initialState.history);

  // Drawers
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [newToolOpen, setNewToolOpen] = useState(false);

  const enabledTools = tools.filter((t: any) => t.enabled);

  const filled = [
    role.trim() && goal.trim(),
    enabledTools.length > 0,
    knowledge.length > 0,
    guardrails.length > 0,
    !!trigger,
  ].filter(Boolean).length;

  function applyTemplate(tpl: any) {
    setRole(`You are a ${tpl.name.toLowerCase()} agent. ${tpl.desc}`);
    setGoal(tpl.desc);
    setTools(tools.map((t: any) => ({ ...t, enabled: tpl.tools.includes(t.name) })));
    setTemplatesOpen(false);
  }

  function runBench() {
    setRunning(true);
    setBenchResult(null);
    setTimeout(() => {
      setBenchResult({
        trace: [
          { tag: "skill", text: "Loaded role + goal · 184 tokens" },
          { tag: "tool", text: "SQL query → SELECT * FROM approved_suppliers WHERE name='Acme Corp' → 1 match" },
          { tag: "knowledge", text: "Retrieved 2 chunks from AP Policy v3.2.pdf" },
          { tag: "guardrail", text: "Passed: amount $4,820 ≤ $10,000 threshold" },
        ],
        final: `{\n  "invoice_id": "INV-3122",\n  "valid": true,\n  "issues": [],\n  "next_step": "approve"\n}`,
      });
      setRunning(false);
      setHistory([{ id: "h-" + Date.now(), time: "just now", ok: true, summary: "INV-3122 → approve" }, ...history.slice(0, 4)]);
    }, 900);
  }

  return {
    role, setRole,
    goal, setGoal,
    constraints, setConstraints,
    outputSchema, setOutputSchema,
    examples, setExamples,
    tools, setTools, enabledTools,
    knowledge, setKnowledge,
    guardrails, setGuardrails,
    trigger, setTrigger,
    benchOpen, setBenchOpen,
    benchInput, setBenchInput,
    benchResult, setBenchResult,
    running,
    history,
    templatesOpen, setTemplatesOpen,
    newToolOpen, setNewToolOpen,
    filled,
    applyTemplate,
    runBench,
  };
}

const Ctx = createContext<AgentCtx | null>(null);

export function AgentProvider({ children }: { children: ReactNode }) {
  const value = useAgentState();
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAgent() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAgent must be used inside <AgentProvider>");
  return v;
}
