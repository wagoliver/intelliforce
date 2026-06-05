"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { AgentDots } from "@/components/org/AgentDots";
import { Timeline } from "@/components/org/Timeline";
import { WorkforceBar } from "@/components/org/WorkforceBar";
import { departments, type DepartmentOut } from "@/lib/api/departments";
import { formatHandle, metrics, type DepartmentMetricsOut } from "@/lib/api/metrics";
import {
  aggregateCounts,
  formatFuture,
  healthColor,
  money,
  type StatusCounts,
} from "@/lib/org/status";

export default function DepartmentDetail() {
  const params = useParams();
  const id = String(params.id);
  const [dept, setDept] = useState<DepartmentOut | null>(null);
  const [m, setM] = useState<DepartmentMetricsOut | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    departments
      .get(id)
      .then((d) => !cancelled && setDept(d))
      .catch((e: Error) => !cancelled && setError(e.message));
    metrics
      .department(id)
      .then((x) => !cancelled && setM(x))
      .catch(() => {
        /* métricas são opcionais */
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const back = (
    <Link
      href="/departments"
      className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg"
    >
      <ChevronLeft size={16} /> Equipe
    </Link>
  );

  if (!dept) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        {error ? (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        ) : (
          <p className="py-10 text-center text-sm text-fg-muted">Carregando…</p>
        )}
      </div>
    );
  }

  const counts = aggregateCounts(dept);

  return (
    <div className="stagger flex flex-col gap-4">
      {back}

      {/* Hero */}
      <div className="panel card-glow mesh-hero p-5">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: healthColor(dept.health) }}
          />
          <h1 className="min-w-0 flex-1 truncate font-display text-xl font-semibold text-fg">
            {dept.display_name}
          </h1>
        </div>
        {dept.owner && (
          <p className="mt-1 text-xs text-fg-subtle">
            {dept.owner.name} · {dept.owner.role}
          </p>
        )}
        {dept.objective && <p className="mt-3 text-sm text-fg-muted">{dept.objective}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-subtle">
          <span>{money(dept.monthly_cost_budget_usd)}/mês</span>
          <span>próxima {formatFuture(dept.next_run)}</span>
          <span>{dept.total_agents} agentes</span>
        </div>
      </div>

      {/* Métricas 12h */}
      {m && (
        <div className="panel card-glow p-4">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-fg-subtle">
            Últimas 12h
          </p>
          <div className="grid grid-cols-4 gap-2 text-center">
            <Stat value={String(m.executed_last_12h)} label="Exec." />
            <Stat
              value={String(m.failed_last_12h)}
              label="Falhas"
              color={m.failed_last_12h > 0 ? "#ef4444" : undefined}
            />
            <Stat value={formatHandle(m.avg_handle_seconds)} label="Médio" />
            <Stat
              value={`${m.error_pct.toFixed(1)}%`}
              label="Erro"
              color={m.error_pct > 2 ? "#ef4444" : undefined}
            />
          </div>
          {m.timeline?.length > 0 && (
            <div className="mt-4">
              <Timeline buckets={m.timeline} />
            </div>
          )}
        </div>
      )}

      {/* Força de trabalho */}
      <div className="panel card-glow p-4">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-fg-subtle">
          Força de trabalho
        </p>
        <AgentDots counts={counts} />
      </div>

      {/* Estrutura */}
      <div className="flex flex-col gap-3">
        <p className="px-1 font-mono text-[11px] uppercase tracking-widest text-fg-subtle">
          Estrutura
        </p>
        {dept.squads.length === 0 && (
          <div className="panel p-6 text-center text-sm text-fg-muted">Sem squads.</div>
        )}
        {dept.squads.map((sq) => (
          <div key={sq.id} className="panel p-4">
            <p className="mb-2 font-display text-sm font-semibold text-fg">{sq.display_name}</p>
            <div className="flex flex-col gap-3">
              {sq.activities.length === 0 && (
                <p className="text-xs text-fg-subtle">Sem atividades.</p>
              )}
              {sq.activities.map((a) => {
                const ac: StatusCounts = {
                  active: a.active_count,
                  idle: a.idle_count,
                  offline: a.offline_count,
                  error: a.error_count,
                };
                return (
                  <div key={a.id} className="border-t border-border pt-3 first:border-0 first:pt-0">
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className="badge bg-accent-soft font-mono text-[10px] text-accent">
                        {a.skill_code}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-fg">
                        {a.display_name}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-fg-subtle">
                        {a.agent_count}/{a.target_agent_count}
                      </span>
                    </div>
                    <WorkforceBar counts={ac} />
                    <p className="mt-1.5 text-[11px] text-fg-subtle">
                      {a.active_count} ativos · próxima {formatFuture(a.next_run)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div className="flex flex-col">
      <span
        className="font-display text-lg font-semibold text-fg"
        style={color ? { color } : undefined}
      >
        {value}
      </span>
      <span className="text-[10px] uppercase tracking-wide text-fg-subtle">{label}</span>
    </div>
  );
}
