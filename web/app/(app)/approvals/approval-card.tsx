"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ApprovalItem } from "@/lib/api/types";
import { decideApprovalAction } from "./actions";

export function ApprovalCard({ approval }: { approval: ApprovalItem }) {
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function decide(decision: "approve" | "reject") {
    setPending(true);
    await decideApprovalAction(approval.id, decision, reason);
    setPending(false);
    router.refresh();
  }

  return (
    <div className="panel p-5 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-fg-muted font-mono">{approval.id}</div>
          <div className="text-sm mt-1">
            Tarefa: <span className="font-mono">{approval.task_id}</span>
          </div>
        </div>
        <div className="text-xs text-fg-muted">
          {new Date(approval.created_at).toLocaleString("pt-BR")}
        </div>
      </div>
      {approval.requested_reason && (
        <p className="text-sm bg-bg-subtle rounded p-3">{approval.requested_reason}</p>
      )}
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Justificativa (opcional)"
        className="input"
      />
      <div className="flex gap-2 justify-end">
        <button onClick={() => decide("reject")} disabled={pending} className="btn-outline">
          Rejeitar
        </button>
        <button onClick={() => decide("approve")} disabled={pending} className="btn-primary">
          Aprovar
        </button>
      </div>
    </div>
  );
}
