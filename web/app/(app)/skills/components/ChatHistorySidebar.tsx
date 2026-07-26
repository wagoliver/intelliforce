"use client";

import { useEffect, useRef, useState } from "react";

import type { ChatSessionItem } from "../hooks/useChatSessions";

type Props = {
  sessions: ChatSessionItem[];
  loading: boolean;
  activeOpencodeSessionId: string | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onNewConversation: () => void;
  onOpenSession: (s: ChatSessionItem) => void;
  onArchive: (s: ChatSessionItem) => void;
  onRename: (s: ChatSessionItem, title: string) => void;
};

/**
 * Sidebar à esquerda do centro de comando: lista de conversas do usuário,
 * estilo ChatGPT. Cada item é clicável (abre a conversa via OpenCode
 * --session). Botão "+ Nova" reseta o state.
 *
 * Colapsável: quando collapsed, mostra só ícone + botão de toggle.
 */
export function ChatHistorySidebar({
  sessions,
  loading,
  activeOpencodeSessionId,
  collapsed,
  onToggleCollapsed,
  onNewConversation,
  onOpenSession,
  onArchive,
  onRename,
}: Props) {
  return (
    <aside
      className={`skills-history ${collapsed ? "skills-history--collapsed" : "skills-history--expanded"}`}
      aria-label="Histórico de conversas"
    >
      <div className="skills-history-header">
        {!collapsed && <span className="skills-history-eyebrow">Conversas</span>}
        <button
          type="button"
          className="skills-history-toggle"
          onClick={onToggleCollapsed}
          title={collapsed ? "Expandir histórico" : "Recolher histórico"}
          aria-label={collapsed ? "Expandir histórico" : "Recolher histórico"}
        >
          {collapsed ? (
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M6 4l4 4-4 4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M10 4l-4 4 4 4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      </div>

      <button
        type="button"
        className="skills-history-new"
        onClick={onNewConversation}
        title="Iniciar nova conversa"
      >
        <svg viewBox="0 0 16 16" width={14} height={14} aria-hidden="true">
          <path
            d="M8 3v10M3 8h10"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
        {!collapsed && <span>Nova conversa</span>}
      </button>

      {!collapsed && (
        <div className="skills-history-body">
          {loading ? (
            <div className="skills-history-empty">carregando…</div>
          ) : sessions.length === 0 ? (
            <div className="skills-history-empty">
              nenhuma conversa ainda. envie uma mensagem pra começar.
            </div>
          ) : (
            <ul className="skills-history-list">
              {sessions.map((s) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  active={s.opencode_session_id === activeOpencodeSessionId}
                  onOpen={() => onOpenSession(s)}
                  onArchive={() => onArchive(s)}
                  onRename={(title) => onRename(s, title)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </aside>
  );
}

function SessionRow({
  session,
  active,
  onOpen,
  onArchive,
  onRename,
}: {
  session: ChatSessionItem;
  active: boolean;
  onOpen: () => void;
  onArchive: () => void;
  onRename: (title: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const title = session.title?.trim() || "(sem título)";
  const subtitle = session.last_message_preview?.trim() || "—";
  const when = relativeTime(session.updated_at);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function startEditing() {
    setDraft(session.title?.trim() || "");
    setEditing(true);
  }

  function commitEdit() {
    const trimmed = draft.trim();
    setEditing(false);
    if (trimmed && trimmed !== (session.title?.trim() || "")) {
      onRename(trimmed);
    }
  }

  return (
    <li className={`skills-history-item ${active ? "skills-history-item--active" : ""}`}>
      {editing ? (
        <input
          ref={inputRef}
          className="skills-history-item-edit"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitEdit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setEditing(false);
            }
          }}
          placeholder="Nome da conversa"
        />
      ) : (
        <button
          type="button"
          className="skills-history-item-main"
          onClick={onOpen}
          onDoubleClick={(e) => {
            e.stopPropagation();
            startEditing();
          }}
          title={title}
        >
          <span className="skills-history-item-title">{title}</span>
          <span className="skills-history-item-meta">
            <span className="skills-history-item-agent">{session.agent}</span>
            <span className="skills-history-item-when">{when}</span>
          </span>
          <span className="skills-history-item-preview">{subtitle}</span>
        </button>
      )}
      <div className="skills-history-item-actions">
        {confirmDelete ? (
          <>
            <button
              type="button"
              className="skills-history-item-confirm"
              onClick={(e) => {
                e.stopPropagation();
                onArchive();
              }}
              title="Confirmar arquivamento"
            >
              confirmar
            </button>
            <button
              type="button"
              className="skills-history-item-cancel"
              onClick={(e) => {
                e.stopPropagation();
                setConfirmDelete(false);
              }}
              title="Cancelar"
            >
              ✕
            </button>
          </>
        ) : !editing ? (
          <>
            <button
              type="button"
              className="skills-history-item-rename"
              onClick={(e) => {
                e.stopPropagation();
                startEditing();
              }}
              title="Renomear conversa"
              aria-label="Renomear conversa"
            >
              <svg viewBox="0 0 16 16" width={12} height={12} aria-hidden="true">
                <path
                  d="M11.3 2.7a1 1 0 0 1 1.4 0l.6.6a1 1 0 0 1 0 1.4l-6.8 6.8-2.4.6.6-2.4z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              className="skills-history-item-delete"
              onClick={(e) => {
                e.stopPropagation();
                setConfirmDelete(true);
              }}
              title="Arquivar conversa"
              aria-label="Arquivar conversa"
            >
              <svg viewBox="0 0 16 16" width={12} height={12} aria-hidden="true">
                <path
                  d="M3 5h10M6 5V3.5A.5.5 0 0 1 6.5 3h3a.5.5 0 0 1 .5.5V5M4.5 5l.6 8a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.6-8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </>
        ) : null}
      </div>
    </li>
  );
}

function relativeTime(iso: string): string {
  const t = Date.parse(iso);
  if (!t) return "";
  const diffMs = Date.now() - t;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "agora";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  const wk = Math.floor(day / 7);
  if (wk < 4) return `${wk}sem`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mês`;
  const yr = Math.floor(day / 365);
  return `${yr}ano`;
}
