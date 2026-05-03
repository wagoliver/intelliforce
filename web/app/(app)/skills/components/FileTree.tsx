"use client";

import type { OpenCodeFile, OpenCodeTree } from "../hooks/useOpenCodeTree";

type Props = {
  tree: OpenCodeTree;
  loading: boolean;
  error: string | null;
  selected: { kind: OpenCodeFile["kind"]; slug: string } | null;
  collapsed: boolean;
  onSelect: (file: OpenCodeFile) => void;
  onToggleCollapsed: () => void;
};

export function FileTree({ tree, loading, error, selected, collapsed, onSelect, onToggleCollapsed }: Props) {
  const total = tree.skills.length + tree.agents.length + tree.commands.length;

  if (collapsed) {
    return (
      <aside
        style={{
          width: 44,
          borderRight: "1px solid var(--border)",
          background: "var(--bg-sunken)",
          padding: "10px 6px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <button
          onClick={onToggleCollapsed}
          title="Expandir tree"
          aria-label="Expandir tree de arquivos"
          style={{
            width: 32,
            height: 32,
            border: "1px solid transparent",
            borderRadius: 6,
            background: "transparent",
            color: "var(--text-muted)",
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
          }}
        >
          <svg width={16} height={16} viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 3h10v10H3z M3 7h10 M6 3v10" stroke="currentColor" strokeWidth="1.4" fill="none" />
          </svg>
        </button>
        <div
          style={{
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            color: "var(--text-subtle)",
            textAlign: "center",
            marginTop: 6,
          }}
        >
          {total}
        </div>
      </aside>
    );
  }

  return (
    <aside
      style={{
        width: 240,
        borderRight: "1px solid var(--border)",
        background: "var(--bg-sunken)",
        padding: "12px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        overflowY: "auto",
      }}
    >
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div
          style={{
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            color: "var(--text-subtle)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          opencode
        </div>
        <button
          onClick={onToggleCollapsed}
          title="Colapsar tree"
          aria-label="Colapsar tree de arquivos"
          style={{
            width: 22,
            height: 22,
            border: "1px solid transparent",
            borderRadius: 5,
            background: "transparent",
            color: "var(--text-subtle)",
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
          }}
        >
          <svg width={12} height={12} viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </header>

      {loading && <div style={{ fontSize: 12, color: "var(--text-subtle)" }}>carregando…</div>}
      {error && (
        <div style={{ fontSize: 11.5, color: "var(--danger)" }} role="alert">
          {error}
        </div>
      )}

      <Section title="skills" files={tree.skills} selected={selected} onSelect={onSelect} />
      <Section title="agents" files={tree.agents} selected={selected} onSelect={onSelect} />
      <Section title="commands" files={tree.commands} selected={selected} onSelect={onSelect} />
    </aside>
  );
}

function Section({
  title,
  files,
  selected,
  onSelect,
}: {
  title: string;
  files: OpenCodeFile[];
  selected: { kind: OpenCodeFile["kind"]; slug: string } | null;
  onSelect: (file: OpenCodeFile) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div
        style={{
          fontSize: 10.5,
          fontFamily: "var(--font-mono)",
          color: "var(--text-subtle)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          padding: "0 6px",
        }}
      >
        {title}
        <span style={{ marginLeft: 6, color: "var(--text-subtle)" }}>·</span>
        <span style={{ marginLeft: 4 }}>{files.length}</span>
      </div>
      {files.length === 0 ? (
        <div style={{ fontSize: 11.5, color: "var(--text-subtle)", padding: "2px 6px", fontStyle: "italic" }}>
          vazio
        </div>
      ) : (
        files.map((f) => {
          const isSelected = selected?.kind === f.kind && selected?.slug === f.slug;
          return (
            <button
              key={`${f.kind}/${f.slug}`}
              onClick={() => onSelect(f)}
              title={f.description ?? ""}
              style={{
                textAlign: "left",
                padding: "5px 6px",
                border: "1px solid transparent",
                borderRadius: 5,
                background: isSelected ? "var(--bg-elev)" : "transparent",
                color: isSelected ? "var(--text)" : "var(--text-muted)",
                fontSize: 12.5,
                cursor: "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                gap: 6,
                width: "100%",
              }}
            >
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-subtle)" }}>·</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.slug}</span>
            </button>
          );
        })
      )}
    </div>
  );
}
