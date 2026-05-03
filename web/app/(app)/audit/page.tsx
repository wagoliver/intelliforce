import { audit } from "@/lib/api/audit";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const [events, summary7, summary30] = await Promise.all([
    audit.events({ limit: 100 }).catch(() => []),
    audit.costSummary(7).catch(() => null),
    audit.costSummary(30).catch(() => null),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Auditoria</h1>
        <p className="text-sm text-fg-muted mt-1">
          Eventos do sistema e métricas de custo.
        </p>
      </header>

      <section className="grid sm:grid-cols-2 gap-4">
        <CostCard title="Últimos 7 dias" data={summary7} />
        <CostCard title="Últimos 30 dias" data={summary30} />
      </section>

      <section className="panel p-6">
        <h2 className="font-display font-semibold mb-4">Eventos recentes</h2>
        {events.length === 0 ? (
          <p className="text-sm text-fg-muted">Nenhum evento registrado ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-fg-muted">
              <tr>
                <th className="text-left py-2">Quando</th>
                <th className="text-left py-2">Tipo</th>
                <th className="text-left py-2">Aggregate</th>
                <th className="text-left py-2">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {events.map((e) => (
                <tr key={e.event_id}>
                  <td className="py-2 text-fg-muted whitespace-nowrap">
                    {new Date(e.occurred_at).toLocaleString("pt-BR")}
                  </td>
                  <td className="py-2 font-mono text-xs">{e.event_type}</td>
                  <td className="py-2 font-mono text-xs">
                    {e.aggregate_type}/{e.aggregate_id.slice(0, 8)}
                  </td>
                  <td className="py-2 text-fg-muted text-xs">{e.actor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function CostCard({ title, data }: { title: string; data: any }) {
  return (
    <div className="panel p-5">
      <div className="text-xs uppercase text-fg-muted">{title}</div>
      {!data ? (
        <div className="text-fg-muted mt-2">—</div>
      ) : (
        <dl className="mt-2 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-fg-muted">Chamadas</dt>
            <dd className="font-mono">{data.total_calls}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-fg-muted">Tokens (in/out)</dt>
            <dd className="font-mono">
              {data.total_input_tokens} / {data.total_output_tokens}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-fg-muted">Custo total</dt>
            <dd className="font-mono">${Number(data.total_cost_usd).toFixed(4)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-fg-muted">Latência média</dt>
            <dd className="font-mono">
              {data.avg_latency_ms ? `${Math.round(data.avg_latency_ms)}ms` : "—"}
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}
