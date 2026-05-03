"use client";

import type { OpenCodeFile, OpenCodeTree } from "../hooks/useOpenCodeTree";

type Props = {
  tree: OpenCodeTree;
  loading: boolean;
  error: string | null;
  selected: { kind: OpenCodeFile["kind"]; slug: string } | null;
  collapsed: boolean;
  recentlyCreated: Set<string>; // chave: `${kind}/${slug}`
  onSelect: (file: OpenCodeFile) => void;
  onToggleCollapsed: () => void;
};

export function FileTree({
  tree,
  loading,
  error,
  selected,
  collapsed,
  recentlyCreated,
  onSelect,
  onToggleCollapsed,
}: Props) {
  const total = tree.skills.length + tree.agents.length + tree.commands.length;

  if (collapsed) {
    return (
      <aside className="skills-tree skills-tree--collapsed" aria-label="File tree colapsada">
        <button
          type="button"
          className="skills-tree-toggle"
          onClick={onToggleCollapsed}
          title="Expandir tree"
          aria-label="Expandir tree de arquivos"
        >
          <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M6 4l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.4"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--text-subtle)",
            marginTop: 4,
          }}
        >
          {total}
        </div>
      </aside>
    );
  }

  return (
    <aside className="skills-tree skills-tree--expanded" aria-label="File tree do OpenCode">
      <header className="skills-tree-header">
        <span className="skills-tree-eyebrow">opencode</span>
        <button
          type="button"
          className="skills-tree-toggle"
          onClick={onToggleCollapsed}
          title="Colapsar tree"
          aria-label="Colapsar tree"
        >
          <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M10 4l-4 4 4 4"
              stroke="currentColor"
              strokeWidth="1.4"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </header>

      {loading && <div className="skills-tree-empty">carregando…</div>}
      {error && (
        <div role="alert" className="skills-tree-empty" style={{ color: "var(--danger)" }}>
          {error}
        </div>
      )}

      <Section
        title="skills"
        files={tree.skills}
        selected={selected}
        recentlyCreated={recentlyCreated}
        onSelect={onSelect}
      />
      <Section
        title="agents"
        files={tree.agents}
        selected={selected}
        recentlyCreated={recentlyCreated}
        onSelect={onSelect}
      />
      <Section
        title="commands"
        files={tree.commands}
        selected={selected}
        recentlyCreated={recentlyCreated}
        onSelect={onSelect}
      />
    </aside>
  );
}

function Section({
  title,
  files,
  selected,
  recentlyCreated,
  onSelect,
}: {
  title: string;
  files: OpenCodeFile[];
  selected: { kind: OpenCodeFile["kind"]; slug: string } | null;
  recentlyCreated: Set<string>;
  onSelect: (file: OpenCodeFile) => void;
}) {
  return (
    <div className="skills-tree-section">
      <div className="skills-tree-section-label">
        <span>{title}</span>
        <span className="skills-tree-section-count">·</span>
        <span className="skills-tree-section-count">{files.length}</span>
      </div>
      {files.length === 0 ? (
        <div className="skills-tree-empty">vazio</div>
      ) : (
        files.map((f) => {
          const key = `${f.kind}/${f.slug}`;
          const isSelected = selected?.kind === f.kind && selected?.slug === f.slug;
          const justCreated = recentlyCreated.has(key);
          return (
            <button
              key={key}
              type="button"
              title={f.description ?? ""}
              className={[
                "skills-tree-item",
                isSelected && "skills-tree-item--selected",
                justCreated && "skills-tree-item--just-created",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onSelect(f)}
              onMouseMove={(e) => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
                e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.removeProperty("--mx");
                e.currentTarget.style.removeProperty("--my");
              }}
            >
              <span className="skills-tree-item-dot" aria-hidden="true" />
              <span className="skills-tree-item-name">{f.slug}</span>
            </button>
          );
        })
      )}
    </div>
  );
}
