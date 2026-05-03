import Link from "next/link";

import { agents as agentsApi } from "@/lib/api/agents";
import { tasks as tasksApi } from "@/lib/api/tasks";
import { CreateTaskButton } from "./create-task";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const [list, agents] = await Promise.all([
    tasksApi.list({ limit: 100 }).catch(() => []),
    agentsApi.list().catch(() => []),
  ]);
  const agentMap = new Map(agents.map((a) => [a.id, a]));

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Tarefas</h1>
          <p className="text-sm text-fg-muted mt-1">Execuções dos agentes.</p>
        </div>
        <CreateTaskButton agents={agents} />
      </header>

      {list.length === 0 ? (
        <div className="panel p-12 text-center">
          <p className="text-fg-muted">Nenhuma tarefa ainda. Crie uma usando o botão acima.</p>
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-bg-subtle text-xs uppercase text-fg-muted">
              <tr>
                <th className="text-left px-4 py-3">Agente</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Iniciada</th>
                <th className="text-right px-4 py-3">Tokens</th>
                <th className="text-right px-4 py-3">Duração</th>
                <th className="text-right px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.map((t) => {
                const agent = agentMap.get(t.agent_id);
                const duration =
                  t.started_at && t.finished_at
                    ? `${Math.round(
                        (new Date(t.finished_at).getTime() - new Date(t.started_at).getTime()) / 1000
                      )}s`
                    : "—";
                return (
                  <tr key={t.id} className="hover:bg-bg-subtle/50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{agent?.display_name ?? t.agent_id}</div>
                      <div className="text-xs text-fg-muted truncate max-w-xs">{t.prompt}</div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-3 text-fg-muted">
                      {t.started_at ? new Date(t.started_at).toLocaleString("pt-BR") : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-fg-muted">
                      {t.tokens_input > 0 ? `${t.tokens_input}/${t.tokens_output}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-fg-muted">{duration}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/tasks/${t.id}`} className="text-accent text-sm hover:underline">
                        Detalhes
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    pending: { color: "bg-fg-subtle/20 text-fg-muted", label: "Pendente" },
    running: { color: "bg-accent/10 text-accent", label: "Executando" },
    awaiting_approval: { color: "bg-warning/10 text-warning", label: "Aguardando" },
    completed: { color: "bg-success/10 text-success", label: "Concluída" },
    failed: { color: "bg-danger/10 text-danger", label: "Falhou" },
    cancelled: { color: "bg-fg-subtle/20 text-fg-muted", label: "Cancelada" },
  };
  const cfg = map[status] ?? { color: "bg-fg-subtle/20", label: status };
  return <span className={`badge ${cfg.color}`}>{cfg.label}</span>;
}
