"use client";

import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { Agent } from "@/lib/api/types";
import { createTaskAction } from "./actions";

export function CreateTaskButton({ agents }: { agents: Agent[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  if (agents.length === 0) {
    return (
      <button disabled className="btn-primary opacity-50 cursor-not-allowed" title="Crie um agente primeiro">
        <Plus className="size-4" />
        Nova tarefa
      </button>
    );
  }

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await createTaskAction(formData);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus className="size-4" />
        Nova tarefa
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-fg/40 p-4">
          <div className="panel max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Nova tarefa</h2>
              <button onClick={() => setOpen(false)} className="text-fg-muted hover:text-fg">
                <X className="size-5" />
              </button>
            </div>

            <form action={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="label">Agente</label>
                <select name="agent_id" required className="input">
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.display_name} ({a.name})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="label">Prompt</label>
                <textarea
                  name="prompt"
                  rows={4}
                  required
                  className="input"
                  placeholder="Descreva o que o agente deve fazer..."
                />
              </div>

              {error && <p className="text-xs text-danger">{error}</p>}

              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setOpen(false)} className="btn-outline">
                  Cancelar
                </button>
                <button type="submit" disabled={pending} className="btn-primary">
                  {pending ? "Criando..." : "Criar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
