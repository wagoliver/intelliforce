"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

import type { OpenCodeFile, OpenCodeTree } from "../hooks/useOpenCodeTree";
import {
  ChevronIcon,
  FileMarkdownIcon,
  FolderClosedIcon,
  FolderEmptyIcon,
  FolderOpenIcon,
  LockBadge,
} from "./FileTreeIcons";

/**
 * Slugs imutáveis (system seeds). Frontend hardcoda enquanto a API não expõe
 * o campo `protected`. TODO: trocar por flag vinda do GET /opencode/tree.
 *
 * Inclui: agentes seed (builder, operator) + skill base do operator
 * (intelliforce-api). As 10 skills intelliforce-* restantes serão adicionadas
 * conforme cada fase do Refinement 2 entra em produção.
 */
const SEED_KEYS = new Set<string>([
  "agent/builder",
  "agent/operator",
  "skill/karpathy-guidelines",
  "skill/intelliforce-api",
  "skill/intelliforce-discover",
  "skill/intelliforce-departments",
  "skill/intelliforce-squads",
  "skill/intelliforce-activities",
  "skill/intelliforce-agents",
  "skill/intelliforce-instances",
]);

type Selected = { kind: OpenCodeFile["kind"]; slug: string } | null;

type Props = {
  tree: OpenCodeTree;
  loading: boolean;
  error: string | null;
  selected: Selected;
  collapsed: boolean;
  recentlyCreated: Set<string>;
  onSelect: (file: OpenCodeFile) => void;
  onToggleCollapsed: () => void;
};

const ANIM = {
  initial: { height: 0, opacity: 0 },
  animate: { height: "auto", opacity: 1 },
  exit: { height: 0, opacity: 0 },
  transition: { duration: 0.22, ease: [0.32, 0.72, 0, 1] as const },
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
  // Estado de expansão de cada folder. Default: 3 categorias raiz expandidas;
  // skill-instances (cada slug de skill) colapsados (user clica pra abrir).
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(["root:agents", "root:skills", "root:commands"]),
  );

  const total = tree.skills.length + tree.agents.length + tree.commands.length;

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

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
        <span className="skills-tree-eyebrow">.opencode</span>
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

      <div className="skills-tree-body" role="tree">
        {/* agents — files diretos */}
        <CategoryFolder
          label="agents"
          count={tree.agents.length}
          expanded={expanded.has("root:agents")}
          onToggle={() => toggle("root:agents")}
        >
          {tree.agents.map((f) => (
            <FileLeaf
              key={`agent/${f.slug}`}
              file={f}
              filename={`${f.slug}.md`}
              selected={selected}
              recentlyCreated={recentlyCreated}
              onSelect={onSelect}
            />
          ))}
        </CategoryFolder>

        {/* skills — cada slug é um folder com SKILL.md dentro */}
        <CategoryFolder
          label="skills"
          count={tree.skills.length}
          expanded={expanded.has("root:skills")}
          onToggle={() => toggle("root:skills")}
        >
          {tree.skills.map((f) => {
            const key = `skill/${f.slug}`;
            const folderKey = `skill-folder:${f.slug}`;
            const isFolderExpanded = expanded.has(folderKey);
            const isSeed = SEED_KEYS.has(key);
            return (
              <SkillFolder
                key={key}
                file={f}
                isSeed={isSeed}
                expanded={isFolderExpanded}
                onToggle={() => toggle(folderKey)}
              >
                <FileLeaf
                  file={f}
                  filename="SKILL.md"
                  selected={selected}
                  recentlyCreated={recentlyCreated}
                  onSelect={onSelect}
                />
              </SkillFolder>
            );
          })}
        </CategoryFolder>

        {/* commands — files diretos (geralmente vazio no MVP) */}
        <CategoryFolder
          label="commands"
          count={tree.commands.length}
          expanded={expanded.has("root:commands")}
          onToggle={() => toggle("root:commands")}
          empty={tree.commands.length === 0}
        >
          {tree.commands.length === 0 ? (
            <div className="skills-tree-empty-line">vazio</div>
          ) : (
            tree.commands.map((f) => (
              <FileLeaf
                key={`command/${f.slug}`}
                file={f}
                filename={`${f.slug}.md`}
                selected={selected}
                recentlyCreated={recentlyCreated}
                onSelect={onSelect}
              />
            ))
          )}
        </CategoryFolder>
      </div>
    </aside>
  );
}

/* -------------------------------------------------------------------------- */
/* Category folder — agents / skills / commands (raiz)                        */
/* -------------------------------------------------------------------------- */

function CategoryFolder({
  label,
  count,
  expanded,
  empty = false,
  onToggle,
  children,
}: {
  label: string;
  count: number;
  expanded: boolean;
  empty?: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const Icon = empty ? FolderEmptyIcon : expanded ? FolderOpenIcon : FolderClosedIcon;
  return (
    <div className="skills-tree-node">
      <button
        type="button"
        className="skills-tree-row skills-tree-row--folder"
        onClick={onToggle}
        aria-expanded={expanded}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
          e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
        }}
      >
        <span className="skills-tree-chevron" style={{ color: "var(--text-subtle)" }}>
          <ChevronIcon expanded={expanded} />
        </span>
        <span className="skills-tree-icon">
          <Icon size={20} />
        </span>
        <span className="skills-tree-name">{label}</span>
        <span className="skills-tree-count">{count}</span>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="children"
            className="skills-tree-children"
            {...ANIM}
            style={{ overflow: "hidden" }}
          >
            <div className="skills-tree-children-inner">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Skill folder — cada slug de skill é uma pasta com SKILL.md dentro          */
/* -------------------------------------------------------------------------- */

function SkillFolder({
  file,
  isSeed,
  expanded,
  onToggle,
  children,
}: {
  file: OpenCodeFile;
  isSeed: boolean;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const Icon = expanded ? FolderOpenIcon : FolderClosedIcon;
  return (
    <div className="skills-tree-node">
      <button
        type="button"
        className="skills-tree-row skills-tree-row--folder skills-tree-row--nested"
        onClick={onToggle}
        aria-expanded={expanded}
        title={file.description ?? ""}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
          e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
        }}
      >
        <span className="skills-tree-chevron" style={{ color: "var(--text-subtle)" }}>
          <ChevronIcon expanded={expanded} />
        </span>
        <span className="skills-tree-icon">
          <Icon size={18} />
          {isSeed && (
            <span className="skills-tree-lock-badge" aria-label="Imutável">
              <LockBadge />
            </span>
          )}
        </span>
        <span className="skills-tree-name skills-tree-name--mono">{file.slug}</span>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="children"
            className="skills-tree-children"
            {...ANIM}
            style={{ overflow: "hidden" }}
          >
            <div className="skills-tree-children-inner">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* File leaf — folha clicável (abre drawer)                                   */
/* -------------------------------------------------------------------------- */

function FileLeaf({
  file,
  filename,
  selected,
  recentlyCreated,
  onSelect,
}: {
  file: OpenCodeFile;
  filename: string;
  selected: Selected;
  recentlyCreated: Set<string>;
  onSelect: (file: OpenCodeFile) => void;
}) {
  const key = `${file.kind}/${file.slug}`;
  const isSelected = selected?.kind === file.kind && selected?.slug === file.slug;
  const justCreated = recentlyCreated.has(key);
  const isSeed = SEED_KEYS.has(key);

  return (
    <button
      type="button"
      title={file.description ?? ""}
      className={[
        "skills-tree-row",
        "skills-tree-row--file",
        "skills-tree-row--nested",
        isSelected && "skills-tree-row--selected",
        justCreated && "skills-tree-row--just-created",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={() => onSelect(file)}
      onMouseMove={(e) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
        e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
      }}
    >
      {/* spacer no lugar do chevron pra alinhar com folder rows */}
      <span className="skills-tree-chevron skills-tree-chevron--spacer" aria-hidden="true" />
      <span className="skills-tree-icon">
        <FileMarkdownIcon size={16} glow={isSelected} />
        {isSeed && (
          <span className="skills-tree-lock-badge" aria-label="Imutável">
            <LockBadge />
          </span>
        )}
      </span>
      <span className="skills-tree-name skills-tree-name--mono">{filename}</span>
    </button>
  );
}
