"use client";

import type { ReactNode } from "react";

import "./department-setup.css";
import "./capabilities.css";

import { AgentProvider, useAgent } from "./_components/agent-context";
import { AgentNavigator } from "./_components/agent-navigator";
import { AgentTabs } from "./_components/agent-tabs";
import { AgentBench } from "./_components/agent-bench";
import { AgentFooter } from "./_components/agent-footer";
import { AgentTemplatesDrawer } from "./_components/agent-templates-drawer";

function Shell({ children }: { children: ReactNode }) {
  const { benchOpen } = useAgent();
  return (
    <>
      <div className={`cap-app ${benchOpen ? "" : "bench-collapsed"}`}>
        <AgentNavigator />
        <div className="cap-editor">
          <AgentTabs />
          {children}
        </div>
        <AgentBench />
      </div>
      <AgentFooter />
      <AgentTemplatesDrawer />
    </>
  );
}

export default function AgentsLayout({ children }: { children: ReactNode }) {
  return (
    <AgentProvider>
      <Shell>{children}</Shell>
    </AgentProvider>
  );
}
