"use client";

import { Check, Download, Link2, Loader2, Printer, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { formatRelativeAge } from "@/lib/api/diagnostics";
import { downloadUrl, reports, type ReportDetailOut } from "@/lib/api/reports";
import { extractHeadings } from "@/lib/reports/toc";

import { MarkdownDoc } from "./MarkdownDoc";

function safeName(title: string): string {
  return (title || "relatorio").replace(/[^\p{L}\p{N} _-]/gu, "").trim() || "relatorio";
}

function sizeLabel(bytes: number): string {
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function ReportDocument({
  report,
  onDeleted,
}: {
  report: ReportDetailOut;
  onDeleted: (id: string) => void;
}) {
  const [busy, setBusy] = useState<"md" | "pdf" | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headings = useMemo(() => extractHeadings(report.content), [report.content]);

  async function handleDownload(fmt: "md" | "pdf") {
    setBusy(fmt);
    setError(null);
    try {
      const res = await fetch(downloadUrl(report.id, fmt));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
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

  async function handleCopyLink() {
    const link = `${window.location.origin}/reports?report=${report.id}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Não foi possível copiar o link.");
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await reports.remove(report.id);
      onDeleted(report.id);
    } catch (e) {
      setError((e as Error).message);
      setDeleting(false);
      setConfirmDel(false);
    }
  }

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <article className="report-document">
      <header className="report-doc-header">
        <h1>{report.title}</h1>
        <p className="report-doc-meta">
          {report.source === "agent" ? "Gerado por agente" : "Gerado"} ·{" "}
          {formatRelativeAge(report.created_at)} · {sizeLabel(report.size_bytes)}
        </p>
        {report.summary && <p className="report-doc-summary">{report.summary}</p>}
        {report.tags?.length > 0 && (
          <div className="report-doc-tags">
            {report.tags.map((t) => (
              <span key={t} className="badge bg-accent-soft text-accent">
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="report-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={() => handleDownload("pdf")}
            disabled={busy !== null}
          >
            {busy === "pdf" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            PDF
          </button>
          <button
            type="button"
            className="btn-outline"
            onClick={() => handleDownload("md")}
            disabled={busy !== null}
          >
            {busy === "md" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            .md
          </button>
          <button type="button" className="btn-outline" onClick={handleCopyLink}>
            {copied ? <Check className="size-4 text-success" /> : <Link2 className="size-4" />}
            {copied ? "Copiado" : "Copiar link"}
          </button>
          <button type="button" className="btn-outline" onClick={() => window.print()}>
            <Printer className="size-4" />
            Imprimir
          </button>
          {confirmDel ? (
            <span className="report-del-confirm">
              <button
                type="button"
                className="btn-danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                Confirmar
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setConfirmDel(false)}
                disabled={deleting}
              >
                Cancelar
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="btn-ghost report-del-btn"
              onClick={() => setConfirmDel(true)}
            >
              <Trash2 className="size-4" />
              Excluir
            </button>
          )}
        </div>

        {error && <p className="report-doc-error">{error}</p>}
      </header>

      <div className="report-body">
        {headings.length > 1 && (
          <nav className="report-toc" aria-label="Nesta página">
            <p className="report-toc-title">Nesta página</p>
            <ul>
              {headings.map((h) => (
                <li key={h.id} className={h.level === 3 ? "is-sub" : ""}>
                  <button type="button" onClick={() => scrollTo(h.id)}>
                    {h.text}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <div className="report-content">
          <MarkdownDoc source={report.content} />
        </div>
      </div>
    </article>
  );
}
