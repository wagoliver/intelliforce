"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { WorkforceBar } from "@/components/org/WorkforceBar";
import { departments, type DepartmentOut } from "@/lib/api/departments";
import {
  aggregateCounts,
  formatFuture,
  healthColor,
  money,
  totalCount,
} from "@/lib/org/status";

export default function DepartmentsPage() {
  const [list, setList] = useState<DepartmentOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setList(await departments.list());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load]);

  if (list === null && !error) {
    return <p className="py-10 text-center text-sm text-fg-muted">Carregando…</p>;
  }

  // Resumo agregado
  const totalActive = list?.reduce((s, d) => s + aggregateCounts(d).active, 0) ?? 0;
  const totalCost = list?.reduce((s, d) => s + (Number(d.monthly_cost_budget_usd) || 0), 0) ?? 0;
  const healthy = list?.filter((d) => d.health === "healthy").length ?? 0;
  const attention = list?.filter((d) => d.health === "attention").length ?? 0;

  return (
    <div className="stagger flex flex-col gap-3">
      <ScreenHeader eyebrow="Organização" title="Equipe" />

      {error && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      {list && list.length > 0 && (
        <div className="panel card-glow p-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Summary value={String(list.length)} label="Departamentos" />
            <Summary value={String(totalActive)} label="Agentes ativos" />
            <Summary value={money(totalCost)} label="Custo / mês" />
          </div>
          <p className="mt-3 text-center text-xs text-fg-subtle">
            {healthy} saudáveis · {attention} em atenção
          </p>
        </div>
      )}

      {list && list.length === 0 && !error && (
        <div className="panel mt-6 p-10 text-center">
          <p className="text-sm text-fg-muted">Nenhum departamento ainda.</p>
        </div>
      )}

      {list?.map((d) => {
        const counts = aggregateCounts(d);
        const total = totalCount(counts);
        return (
          <Link key={d.id} href={`/departments/${d.id}`} className="panel card-glow block p-4">
            <div className="mb-1 flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: healthColor(d.health) }}
              />
              <span className="min-w-0 flex-1 truncate font-display text-base font-semibold text-fg">
                {d.display_name}
              </span>
              <ChevronRight size={16} className="shrink-0 text-fg-subtle" />
            </div>

            {d.owner && (
              <p className="mb-3 truncate text-xs text-fg-subtle">
                {d.owner.name} · {d.owner.role}
              </p>
            )}

            <WorkforceBar counts={counts} />
            <p className="mt-1.5 text-xs text-fg-muted">
              <span className="font-medium text-fg">{counts.active}</span> ativos de {total}
              {counts.error > 0 && (
                <span className="text-danger"> · {counts.error} em erro</span>
              )}
            </p>

            <div className="mt-3 flex items-center gap-3 text-[11px] text-fg-subtle">
              <span>{money(d.monthly_cost_budget_usd)}/mês</span>
              <span>· próxima {formatFuture(d.next_run)}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function Summary({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-display text-xl font-semibold text-fg">{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-fg-subtle">{label}</span>
    </div>
  );
}
