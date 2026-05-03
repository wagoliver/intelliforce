import { approvals } from "@/lib/api/approvals";
import { ApprovalCard } from "./approval-card";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const inbox = await approvals.inbox().catch(() => []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Aprovações pendentes</h1>
        <p className="text-sm text-fg-muted mt-1">
          Tarefas aguardando decisão humana.
        </p>
      </header>

      {inbox.length === 0 ? (
        <div className="panel p-12 text-center">
          <p className="text-fg-muted">Inbox vazio. 🎉</p>
        </div>
      ) : (
        <div className="space-y-3">
          {inbox.map((a) => (
            <ApprovalCard key={a.id} approval={a} />
          ))}
        </div>
      )}
    </div>
  );
}
