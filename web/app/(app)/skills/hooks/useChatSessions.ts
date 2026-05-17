"use client";

import { useCallback, useEffect, useState } from "react";

import type { HistoryMessage } from "./useChatStream";

/** Linha de chat_sessions como retornada pelo GET /chat/sessions. */
export type ChatSessionItem = {
  id: string;                   // UUID interno do IntelliForce
  opencode_session_id: string;  // ses_xxx — usado pra continuar conversa
  agent: string;                // "operator" | "builder" etc
  title: string | null;
  last_message_preview: string | null;
  message_count: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Hook pra listar/atualizar sessões de chat do usuário logado.
 * Não faz polling — o caller dispara `refetch()` depois de stream_end ou
 * após ações que mudam a lista (delete, rename).
 */
export function useChatSessions() {
  const [sessions, setSessions] = useState<ChatSessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/proxy/chat/sessions", { cache: "no-store" });
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        setSessions([]);
        return;
      }
      const data = (await res.json()) as ChatSessionItem[];
      setSessions(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  /** Carrega mensagens de uma sessão específica. Caller passa pro hydrate. */
  const loadMessages = useCallback(
    async (sessionId: string): Promise<HistoryMessage[]> => {
      const res = await fetch(
        `/api/proxy/chat/sessions/${encodeURIComponent(sessionId)}/messages`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as HistoryMessage[];
    },
    [],
  );

  /** Soft-delete (archived_at). Remove da lista localmente após sucesso. */
  const archive = useCallback(
    async (sessionId: string): Promise<boolean> => {
      const res = await fetch(
        `/api/proxy/chat/sessions/${encodeURIComponent(sessionId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) return false;
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      return true;
    },
    [],
  );

  /** Renomeia. Atualiza a lista localmente. */
  const rename = useCallback(
    async (sessionId: string, title: string): Promise<boolean> => {
      const res = await fetch(
        `/api/proxy/chat/sessions/${encodeURIComponent(sessionId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        },
      );
      if (!res.ok) return false;
      const updated = (await res.json()) as ChatSessionItem;
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? updated : s)));
      return true;
    },
    [],
  );

  return { sessions, loading, error, refetch, loadMessages, archive, rename };
}
