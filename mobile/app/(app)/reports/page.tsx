"use client";

import { ChevronRight, FileText } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { markReportsSeen } from "@/components/reports/useUnreadReports";
import { formatRelativeAge } from "@/lib/api/diagnostics";
import { reports, type ReportOut } from "@/lib/api/reports";

function sizeLabel(bytes: number): string {
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export default function ReportsPage() {
  const [list, setList] = useState<ReportOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    reports
      .list()
      .then((data) => {
        if (cancelled) return;
        setList(data);
        markReportsSeen(); // abriu a tela → zera os não-lidos
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, []);

  if (list === null && !error) {
    return <p className="py-10 text-center text-sm text-fg-muted">Carregando…</p>;
  }

  return (
    <div className="stagger flex flex-col gap-3">
      <ScreenHeader eyebrow="Saídas dos agentes" title="Relatórios" />

      {error && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      {list && list.length === 0 && !error && (
        <div className="panel mt-8 flex flex-col items-center gap-2 p-10 text-center">
          <FileText size={28} className="text-fg-subtle" />
          <p className="font-display text-base font-semibold text-fg">Nenhum relatório ainda</p>
          <p className="text-sm text-fg-muted">
            Peça um relatório no Comando e ele aparece aqui.
          </p>
        </div>
      )}

      {list?.map((r) => (
        <Link key={r.id} href={`/reports/${r.id}`} className="panel card-glow block p-4">
          <div className="flex items-center gap-3">
            <FileText size={20} className="shrink-0 text-accent" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-base font-semibold text-fg">{r.title}</p>
              {r.summary && <p className="truncate text-xs text-fg-muted">{r.summary}</p>}
            </div>
            <ChevronRight size={16} className="shrink-0 text-fg-subtle" />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-fg-subtle">
            <span>{formatRelativeAge(r.created_at)}</span>
            <span>· {sizeLabel(r.size_bytes)}</span>
            {r.tags?.slice(0, 3).map((t) => (
              <span key={t} className="badge bg-accent-soft text-accent">
                {t}
              </span>
            ))}
          </div>
        </Link>
      ))}
    </div>
  );
}
