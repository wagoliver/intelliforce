"use client";

import { useCallback, useEffect, useState } from "react";

import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Sheet } from "@/components/ui/Sheet";
import { formatRelativeAge } from "@/lib/api/diagnostics";
import { isCancelable, tasks, type TaskOut } from "@/lib/api/tasks";

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "bg-warning/15 text-warning" },
  running: { label: "Executando", cls: "bg-accent/15 text-accent" },
  awaiting_approval: { label: "Aguardando", cls: "bg-warning/15 text-warning" },
  completed: { label: "Concluída", cls: "bg-success/15 text-success" },
  failed: { label: "Falhou", cls: "bg-danger/15 text-danger" },
  cancelled: { label: "Cancelada", cls: "bg-fg-subtle/15 text-fg-subtle" },
};
function statusMeta(s: string) {
  return STATUS[s] ?? { label: s, cls: "bg-fg-subtle/15 text-fg-subtle" };
}

const FILTERS = [
  { key: "", label: "Todas" },
  { key: "running", label: "Executando" },
  { key: "pending", label: "Pendente" },
  { key: "failed", label: "Falhou" },
  { key: "completed", label: "Concluída" },
] as const;

export default function TasksPage() {
  const [filter, setFilter] = useState("");
  const [items, setItems] = useState<TaskOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<TaskOut | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);

  const load = useCallback(async (f: string) => {
    setItems(null);
    try {
      setItems(await tasks.list({ status_filter: f || undefined, limit: 50 }));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  async function doCancel() {
    if (!selected) return;
    setCancelBusy(true);
    try {
      const updated = await tasks.cancel(selected.id, "");
      setItems((prev) => prev?.map((t) => (t.id === updated.id ? updated : t)) ?? prev);
      setSelected(updated);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCancelBusy(false);
    }
  }

  return (
    <div className="stagger flex flex-col gap-3">
      <ScreenHeader eyebrow="Execuções" title="Tarefas" />
      {/* Filtros */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f.key
                ? "bg-accent text-white"
                : "bg-bg-subtle text-fg-muted hover:text-fg"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      {items === null && !error && (
        <p className="py-10 text-center text-sm text-fg-muted">Carregando…</p>
      )}

      {items && items.length === 0 && !error && (
        <div className="panel mt-8 p-10 text-center">
          <p className="text-sm text-fg-muted">Nenhuma tarefa nesse filtro.</p>
        </div>
      )}

      {items?.map((t) => {
        const meta = statusMeta(t.status);
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setSelected(t)}
            className="panel card-glow p-4 text-left"
          >
            <div className="mb-1.5 flex items-center justify-between">
              <span className={`badge ${meta.cls}`}>{meta.label}</span>
              <span className="text-xs text-fg-subtle">{formatRelativeAge(t.created_at)}</span>
            </div>
            <p className="line-clamp-2 text-sm text-fg">{t.prompt || "(sem prompt)"}</p>
            <div className="mt-2 flex items-center gap-3 font-mono text-[11px] text-fg-subtle">
              <span>task {t.id.slice(0, 8)}</span>
              <span>· {t.tokens_input + t.tokens_output} tok</span>
              <span>· ${Number(t.cost_usd).toFixed(4)}</span>
            </div>
          </button>
        );
      })}

      {/* Detalhe */}
      <Sheet open={selected !== null} onClose={() => setSelected(null)} title="Detalhe da tarefa">
        {selected && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className={`badge ${statusMeta(selected.status).cls}`}>
                {statusMeta(selected.status).label}
              </span>
              <span className="text-xs text-fg-subtle">
                criada {formatRelativeAge(selected.created_at)}
              </span>
            </div>

            <div>
              <p className="mb-1 text-[11px] uppercase tracking-wide text-fg-subtle">Prompt</p>
              <p className="whitespace-pre-wrap break-words text-sm text-fg">
                {selected.prompt || "(sem prompt)"}
              </p>
            </div>

            {selected.error_message && (
              <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                {selected.error_message}
              </div>
            )}

            {selected.result_summary && (
              <div>
                <p className="mb-1 text-[11px] uppercase tracking-wide text-fg-subtle">Resultado</p>
                <pre className="max-h-40 overflow-auto rounded-lg bg-bg-subtle p-3 text-xs text-fg-muted">
                  {JSON.stringify(selected.result_summary, null, 2)}
                </pre>
              </div>
            )}

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <Meta label="Custo" value={`$${Number(selected.cost_usd).toFixed(4)}`} />
              <Meta
                label="Tokens"
                value={`${selected.tokens_input} / ${selected.tokens_output}`}
              />
              <Meta
                label="Início"
                value={selected.started_at ? formatRelativeAge(selected.started_at) : "—"}
              />
              <Meta
                label="Fim"
                value={selected.finished_at ? formatRelativeAge(selected.finished_at) : "—"}
              />
              <Meta label="Origem" value={selected.triggered_by} />
              <Meta label="Agente" value={selected.agent_id.slice(0, 8)} />
            </div>

            {isCancelable(selected.status) && (
              <button
                type="button"
                onClick={doCancel}
                disabled={cancelBusy}
                className="btn-primary mt-1 w-full !bg-danger hover:!bg-danger/90"
              >
                {cancelBusy ? "Cancelando…" : "Cancelar tarefa"}
              </button>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-fg-subtle">{label}</span>
      <span className="truncate font-mono text-xs text-fg">{value}</span>
    </div>
  );
}
