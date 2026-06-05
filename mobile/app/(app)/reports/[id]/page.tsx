"use client";

import { ChevronLeft, Download, Share2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { MarkdownView } from "@/components/chat/MarkdownView";
import { formatRelativeAge } from "@/lib/api/diagnostics";
import { downloadUrl, reports, type ReportDetailOut } from "@/lib/api/reports";

function safeName(title: string): string {
  return (title || "relatorio").replace(/[^\p{L}\p{N} _-]/gu, "").trim() || "relatorio";
}

export default function ReportDetail() {
  const params = useParams();
  const id = String(params.id);
  const [report, setReport] = useState<ReportDetailOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"md" | "pdf" | "share" | null>(null);

  useEffect(() => {
    let cancelled = false;
    reports
      .get(id)
      .then((r) => !cancelled && setReport(r))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function fetchBlob(fmt: "md" | "pdf"): Promise<Blob> {
    const res = await fetch(downloadUrl(id, fmt));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.blob();
  }

  async function handleDownload(fmt: "md" | "pdf") {
    if (!report) return;
    setBusy(fmt);
    try {
      const blob = await fetchBlob(fmt);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName(report.title)}.${fmt}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function handleShare() {
    if (!report) return;
    setBusy("share");
    try {
      const blob = await fetchBlob("pdf");
      const file = new File([blob], `${safeName(report.title)}.pdf`, { type: "application/pdf" });
      const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: report.title });
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: report.title, text: report.summary || report.title });
        return;
      }
      setError("Compartilhamento não suportado neste navegador.");
    } catch (e) {
      // usuário pode cancelar o share — não trata como erro
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const back = (
    <Link
      href="/reports"
      className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg"
    >
      <ChevronLeft size={16} /> Relatórios
    </Link>
  );

  if (!report) {
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

  return (
    <div className="flex flex-col gap-4 pb-6">
      {back}

      <div>
        <h1 className="font-display text-xl font-semibold text-fg">{report.title}</h1>
        <p className="mt-1 text-xs text-fg-subtle">
          {report.source === "agent" ? "Gerado por agente" : "Gerado"} ·{" "}
          {formatRelativeAge(report.created_at)}
        </p>
        {report.summary && <p className="mt-2 text-sm text-fg-muted">{report.summary}</p>}
      </div>

      {error && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      {/* Ações */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleDownload("pdf")}
          disabled={busy !== null}
          className="btn-primary btn-gradient flex-1"
        >
          <Download size={16} /> {busy === "pdf" ? "…" : "PDF"}
        </button>
        <button
          type="button"
          onClick={() => handleDownload("md")}
          disabled={busy !== null}
          className="btn-outline flex-1"
        >
          <Download size={16} /> {busy === "md" ? "…" : ".md"}
        </button>
        <button
          type="button"
          onClick={handleShare}
          disabled={busy !== null}
          aria-label="Compartilhar"
          className="btn-outline !px-3"
        >
          <Share2 size={16} />
        </button>
      </div>

      {/* Preview do conteúdo */}
      <div className="panel p-4">
        <MarkdownView source={report.content} />
      </div>
    </div>
  );
}
