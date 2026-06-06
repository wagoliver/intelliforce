"use client";

import { FileText } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { departments, type DepartmentOut } from "@/lib/api/departments";
import { reports, type ReportDetailOut, type ReportOut } from "@/lib/api/reports";

import { ReportDocument } from "./components/ReportDocument";
import { ReportRail } from "./components/ReportRail";

import "./reports.css";

function ReportsView() {
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get("report");

  const [list, setList] = useState<ReportOut[] | null>(null);
  const [depts, setDepts] = useState<DepartmentOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReportDetailOut | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Lista + departamentos, com refetch leve (mesmo padrão do dashboard).
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await reports.list();
        if (cancelled) return;
        setList(data);
        setError(null);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    }
    void load();
    departments.list().then((d) => !cancelled && setDepts(d)).catch(() => {});
    const timer = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const select = useCallback(
    (id: string) => router.replace(`/reports?report=${id}`, { scroll: false }),
    [router]
  );

  // Auto-seleciona o mais recente quando não há nada na URL.
  useEffect(() => {
    if (list && list.length > 0 && !selectedId) {
      router.replace(`/reports?report=${list[0].id}`, { scroll: false });
    }
  }, [list, selectedId, router]);

  // Carrega o detalhe do relatório selecionado.
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    reports
      .get(selectedId)
      .then((r) => !cancelled && setDetail(r))
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setDetailLoading(false));
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const onDeleted = useCallback(
    (id: string) => {
      setList((prev) => {
        const next = (prev ?? []).filter((r) => r.id !== id);
        const fallback = next[0]?.id;
        router.replace(fallback ? `/reports?report=${fallback}` : "/reports", { scroll: false });
        return next;
      });
      setDetail(null);
    },
    [router]
  );

  if (list === null && !error) {
    return <p className="report-loading">Carregando…</p>;
  }

  if (list && list.length === 0) {
    return (
      <div className="report-empty">
        <FileText className="size-7 text-fg-subtle" />
        <p className="report-empty-title">Nenhum relatório ainda</p>
        <p className="report-empty-sub">
          Peça um relatório no Centro de Comando e ele aparece aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="reports-screen">
      <ReportRail
        reports={list ?? []}
        departments={depts}
        selectedId={selectedId}
        onSelect={select}
      />
      <section className="report-pane">
        {error && <p className="report-doc-error">{error}</p>}
        {detail ? (
          <ReportDocument report={detail} onDeleted={onDeleted} />
        ) : detailLoading ? (
          <p className="report-loading">Carregando relatório…</p>
        ) : (
          <p className="report-pane-hint">Selecione um relatório à esquerda.</p>
        )}
      </section>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<p className="report-loading">Carregando…</p>}>
      <ReportsView />
    </Suspense>
  );
}
