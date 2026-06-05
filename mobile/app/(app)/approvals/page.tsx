"use client";

import { Check, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Sheet } from "@/components/ui/Sheet";
import { approvals, type ApprovalOut } from "@/lib/api/approvals";

/** "há Ns" / "há Nmin" / "há Nh" / "há Nd". */
function formatAge(iso: string): string {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return `há ${secs}s`;
  const min = Math.floor(secs / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

export default function ApprovalsPage() {
  const [items, setItems] = useState<ApprovalOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<ApprovalOut | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    try {
      setItems(await approvals.inbox());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function removeLocal(id: string) {
    setItems((prev) => prev?.filter((x) => x.id !== id) ?? prev);
  }

  async function doApprove(a: ApprovalOut) {
    setBusy(a.id);
    try {
      await approvals.approve(a.id, "");
      removeLocal(a.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function confirmReject() {
    if (!rejecting) return;
    const a = rejecting;
    setBusy(a.id);
    try {
      await approvals.reject(a.id, reason.trim());
      removeLocal(a.id);
      setRejecting(null);
      setReason("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (items === null && !error) {
    return <p className="py-10 text-center text-sm text-fg-muted">Carregando…</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      {items && items.length === 0 && !error && (
        <div className="panel mt-8 flex flex-col items-center gap-2 p-10 text-center">
          <Check size={28} className="text-success" />
          <p className="font-display text-base font-semibold text-fg">Tudo em dia</p>
          <p className="text-sm text-fg-muted">Nenhuma aprovação pendente.</p>
        </div>
      )}

      {items?.map((a) => {
        const isBusy = busy === a.id;
        return (
          <div key={a.id} className="panel p-4">
            <div className="mb-1 flex items-center justify-between">
              <span className="badge bg-warning/15 text-warning">Pendente</span>
              <span className="text-xs text-fg-subtle">{formatAge(a.created_at)}</span>
            </div>
            <p className="text-sm text-fg">
              {a.requested_reason || "Aprovação solicitada (sem motivo informado)."}
            </p>
            <p className="mt-1 font-mono text-[11px] text-fg-subtle">
              task {a.task_id.slice(0, 8)}
            </p>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => doApprove(a)}
                disabled={isBusy}
                className="btn-primary flex-1"
              >
                <Check size={16} /> Aprovar
              </button>
              <button
                type="button"
                onClick={() => setRejecting(a)}
                disabled={isBusy}
                className="btn-outline flex-1 !text-danger"
              >
                <X size={16} /> Rejeitar
              </button>
            </div>
          </div>
        );
      })}

      <Sheet
        open={rejecting !== null}
        onClose={() => {
          setRejecting(null);
          setReason("");
        }}
        title="Rejeitar aprovação"
      >
        <p className="mb-3 text-sm text-fg-muted">
          Opcional: explique o motivo da rejeição. A tarefa será cancelada.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Motivo (opcional)"
          className="input mb-4 resize-none"
        />
        <button
          type="button"
          onClick={confirmReject}
          disabled={busy !== null}
          className="btn-primary w-full !bg-danger hover:!bg-danger/90"
        >
          Confirmar rejeição
        </button>
      </Sheet>
    </div>
  );
}
