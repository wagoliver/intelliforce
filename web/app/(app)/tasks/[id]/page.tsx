import Link from "next/link";
import { notFound } from "next/navigation";

import { agents as agentsApi } from "@/lib/api/agents";
import { audit } from "@/lib/api/audit";
import { tasks } from "@/lib/api/tasks";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [task, timeline] = await Promise.all([
    tasks.get(id).catch(() => null),
    audit.taskTimeline(id).catch(() => []),
  ]);
  if (!task) notFound();
  const agent = await agentsApi.get(task.agent_id).catch(() => null);

  return (
    <div className="space-y-6">
      <Link href="/tasks" className="text-sm text-accent hover:underline">
        ← Voltar
      </Link>

      <header className="flex items-start justify-between">
        <div>
          <div className="text-xs text-fg-muted font-mono">{task.id}</div>
          <h1 className="font-display text-2xl font-semibold mt-1">
            {agent?.display_name ?? "Agente desconhecido"}
          </h1>
          <p className="text-sm text-fg-muted mt-1">
            Status: <span className="font-medium">{task.status}</span> ·{" "}
            Triggered by {task.triggered_by} ·{" "}
            Correlation <span className="font-mono">{task.correlation_id.slice(-8)}</span>
          </p>
        </div>
      </header>

      <section className="grid lg:grid-cols-2 gap-6">
        <div className="panel p-6">
          <h2 className="font-display font-semibold mb-3">Prompt</h2>
          <p className="text-sm whitespace-pre-wrap">{task.prompt || "(sem prompt)"}</p>
        </div>
        <div className="panel p-6">
          <h2 className="font-display font-semibold mb-3">Métricas</h2>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-fg-muted">Tokens (in/out)</dt>
            <dd className="text-right font-mono">
              {task.tokens_input} / {task.tokens_output}
            </dd>
            <dt className="text-fg-muted">Custo (USD)</dt>
            <dd className="text-right font-mono">${Number(task.cost_usd).toFixed(4)}</dd>
            <dt className="text-fg-muted">Iniciada</dt>
            <dd className="text-right">
              {task.started_at ? new Date(task.started_at).toLocaleString("pt-BR") : "—"}
            </dd>
            <dt className="text-fg-muted">Finalizada</dt>
            <dd className="text-right">
              {task.finished_at ? new Date(task.finished_at).toLocaleString("pt-BR") : "—"}
            </dd>
          </dl>
        </div>
      </section>

      {task.result_summary?.text && (
        <section className="panel p-6">
          <h2 className="font-display font-semibold mb-3">Resposta do agente</h2>
          <div className="text-sm whitespace-pre-wrap font-mono bg-bg-subtle p-4 rounded-lg max-h-96 overflow-auto">
            {task.result_summary.text}
          </div>
        </section>
      )}

      {task.error_message && (
        <section className="panel p-6 border-l-4 border-l-danger">
          <h2 className="font-display font-semibold mb-2 text-danger">Erro</h2>
          <pre className="text-sm whitespace-pre-wrap">{task.error_message}</pre>
        </section>
      )}

      <section className="panel p-6">
        <h2 className="font-display font-semibold mb-3">Timeline (auditoria)</h2>
        {timeline.length === 0 ? (
          <p className="text-sm text-fg-muted">Sem eventos registrados ainda.</p>
        ) : (
          <ol className="space-y-3">
            {timeline.map((e) => (
              <li key={e.event_id} className="flex gap-3 text-sm">
                <div className="text-xs text-fg-muted whitespace-nowrap font-mono">
                  {new Date(e.occurred_at).toLocaleTimeString("pt-BR")}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{e.event_type}</div>
                  <div className="text-xs text-fg-muted">por {e.actor}</div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
