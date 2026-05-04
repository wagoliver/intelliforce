"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

import type { OpenCodeFile, OpenCodeScript, OpenCodeTree } from "../hooks/useOpenCodeTree";
import { SEED_KEYS } from "../state/seeds";
import {
  ChevronIcon,
  FileMarkdownIcon,
  FilePythonIcon,
  FolderClosedIcon,
  FolderEmptyIcon,
  FolderOpenIcon,
  LockBadge,
} from "./FileTreeIcons";

type SelectableKind = OpenCodeFile["kind"] | "script";
type Selected = { kind: SelectableKind; slug: string } | null;

/** Item clicável no tree — file (md) ou script (py). */
export type SelectableItem =
  | { kind: "skill" | "agent" | "command"; slug: string; description?: string | null }
  | { kind: "script"; slug: string; description?: string | null };

type Props = {
  tree: OpenCodeTree;
  loading: boolean;
  error: string | null;
  selected: Selected;
  collapsed: boolean;
  recentlyCreated: Set<string>;
  onSelect: (item: SelectableItem) => void;
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
  // Estado de expansão de cada folder. Default: 3 categorias raiz expandidas
  // + bundle "intelliforce" (sub-grupo) expandido. Skill folders individuais
  // ficam colapsados (user clica pra abrir).
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set([
      "root:agents",
      "root:skills",
      "root:commands",
      "root:scripts",
      "bundle:intelliforce",
      "scripts-bundle:intelliforce",
    ]),
  );

  const total =
    tree.skills.length + tree.agents.length + tree.commands.length + tree.scripts.length;

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

        {/* skills — separa bundle intelliforce-* (system seeds do operator) das
            outras (custom criadas pelo user, karpathy, etc). Bundle agrupa
            visualmente sob "intelliforce/" pra evitar 11 nomes longos com o
            mesmo prefixo. No disco continua flat (sem mudança em paths). */}
        <CategoryFolder
          label="skills"
          count={tree.skills.length}
          expanded={expanded.has("root:skills")}
          onToggle={() => toggle("root:skills")}
        >
          {(() => {
            const intelliforceSkills = tree.skills.filter((s) =>
              s.slug.startsWith("intelliforce-"),
            );
            const otherSkills = tree.skills.filter(
              (s) => !s.slug.startsWith("intelliforce-"),
            );
            return (
              <>
                {intelliforceSkills.length > 0 && (
                  <IntelliforceBundle
                    skills={intelliforceSkills}
                    expanded={expanded.has("bundle:intelliforce")}
                    selected={selected}
                    recentlyCreated={recentlyCreated}
                    onToggle={() => toggle("bundle:intelliforce")}
                    onSelect={onSelect}
                  />
                )}
                {otherSkills.map((f) => {
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
              </>
            );
          })()}
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

        {/* scripts — agrupa por skill dona. Espelha o disco
            (<skill>/scripts/<file>.py). Bundle "intelliforce/" pra system seeds. */}
        <CategoryFolder
          label="scripts"
          count={tree.scripts.length}
          expanded={expanded.has("root:scripts")}
          onToggle={() => toggle("root:scripts")}
          empty={tree.scripts.length === 0}
        >
          {tree.scripts.length === 0 ? (
            <div className="skills-tree-empty-line">vazio</div>
          ) : (
            <ScriptsContent
              scripts={tree.scripts}
              expanded={expanded}
              selected={selected}
              onToggle={toggle}
              onSelect={onSelect}
            />
          )}
        </CategoryFolder>
      </div>
    </aside>
  );
}

/* -------------------------------------------------------------------------- */
/* Scripts content — agrupado por skill (intelliforce bundle + custom)        */
/* -------------------------------------------------------------------------- */

function ScriptsContent({
  scripts,
  expanded,
  selected,
  onToggle,
  onSelect,
}: {
  scripts: OpenCodeScript[];
  expanded: Set<string>;
  selected: Selected;
  onToggle: (key: string) => void;
  onSelect: (item: SelectableItem) => void;
}) {
  // Agrupa scripts por skill_slug
  const bySkill = new Map<string, OpenCodeScript[]>();
  for (const s of scripts) {
    const arr = bySkill.get(s.skill_slug) ?? [];
    arr.push(s);
    bySkill.set(s.skill_slug, arr);
  }

  const intelliforceSkills = [...bySkill.keys()]
    .filter((s) => s.startsWith("intelliforce-"))
    .sort();
  const otherSkills = [...bySkill.keys()]
    .filter((s) => !s.startsWith("intelliforce-"))
    .sort();

  return (
    <>
      {intelliforceSkills.length > 0 && (
        <ScriptIntelliforceBundle
          skillSlugs={intelliforceSkills}
          bySkill={bySkill}
          expanded={expanded}
          selected={selected}
          onToggle={onToggle}
          onSelect={onSelect}
        />
      )}
      {otherSkills.map((skillSlug) => {
        const folderKey = `script-folder:${skillSlug}`;
        const isExpanded = expanded.has(folderKey);
        return (
          <ScriptSkillFolder
            key={`script-folder/${skillSlug}`}
            skillSlug={skillSlug}
            scripts={bySkill.get(skillSlug) ?? []}
            expanded={isExpanded}
            selected={selected}
            onToggle={() => onToggle(folderKey)}
            onSelect={onSelect}
          />
        );
      })}
    </>
  );
}

/* IntelliforceBundle equivalente pra scripts (system seeds) */
function ScriptIntelliforceBundle({
  skillSlugs,
  bySkill,
  expanded,
  selected,
  onToggle,
  onSelect,
}: {
  skillSlugs: string[];
  bySkill: Map<string, OpenCodeScript[]>;
  expanded: Set<string>;
  selected: Selected;
  onToggle: (key: string) => void;
  onSelect: (item: SelectableItem) => void;
}) {
  const bundleKey = "scripts-bundle:intelliforce";
  const bundleExpanded = expanded.has(bundleKey);
  const Icon = bundleExpanded ? FolderOpenIcon : FolderClosedIcon;
  const total = skillSlugs.reduce((n, s) => n + (bySkill.get(s)?.length ?? 0), 0);

  return (
    <div className="skills-tree-node">
      <button
        type="button"
        className="skills-tree-row skills-tree-row--folder skills-tree-row--nested"
        onClick={() => onToggle(bundleKey)}
        aria-expanded={bundleExpanded}
        title="Scripts das skills do operator (system seeds)"
        onMouseMove={(e) => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
          e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
        }}
      >
        <span className="skills-tree-chevron" style={{ color: "var(--text-subtle)" }}>
          <ChevronIcon expanded={bundleExpanded} />
        </span>
        <span className="skills-tree-icon">
          <Icon size={18} />
          <span className="skills-tree-lock-badge" aria-label="Imutável">
            <LockBadge />
          </span>
        </span>
        <span className="skills-tree-name skills-tree-name--mono">intelliforce</span>
        <span className="skills-tree-count">{total}</span>
      </button>
      <AnimatePresence initial={false}>
        {bundleExpanded && (
          <motion.div
            key="children"
            className="skills-tree-children"
            {...ANIM}
            style={{ overflow: "hidden" }}
          >
            <div className="skills-tree-children-inner">
              {skillSlugs.map((skillSlug) => {
                const folderKey = `script-folder:${skillSlug}`;
                const isExpanded = expanded.has(folderKey);
                return (
                  <ScriptSkillFolder
                    key={`script-folder/${skillSlug}`}
                    skillSlug={skillSlug}
                    scripts={bySkill.get(skillSlug) ?? []}
                    expanded={isExpanded}
                    selected={selected}
                    onToggle={() => onToggle(folderKey)}
                    onSelect={onSelect}
                    isSeed
                    nameStripPrefix="intelliforce-"
                  />
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* Pasta por skill que tem scripts — abre listando os .py */
function ScriptSkillFolder({
  skillSlug,
  scripts,
  expanded,
  selected,
  onToggle,
  onSelect,
  isSeed = false,
  nameStripPrefix,
}: {
  skillSlug: string;
  scripts: OpenCodeScript[];
  expanded: boolean;
  selected: Selected;
  onToggle: () => void;
  onSelect: (item: SelectableItem) => void;
  isSeed?: boolean;
  nameStripPrefix?: string;
}) {
  const Icon = expanded ? FolderOpenIcon : FolderClosedIcon;
  const displayName = nameStripPrefix
    ? skillSlug.replace(new RegExp(`^${nameStripPrefix}`), "")
    : skillSlug;
  return (
    <div className="skills-tree-node">
      <button
        type="button"
        className="skills-tree-row skills-tree-row--folder skills-tree-row--nested"
        onClick={onToggle}
        aria-expanded={expanded}
        title={`scripts da skill ${skillSlug}`}
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
        <span className="skills-tree-name skills-tree-name--mono">{displayName}</span>
        {scripts.length > 1 && <span className="skills-tree-count">{scripts.length}</span>}
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="children"
            className="skills-tree-children"
            {...ANIM}
            style={{ overflow: "hidden" }}
          >
            <div className="skills-tree-children-inner">
              {scripts.map((s) => (
                <ScriptLeaf
                  key={`script/${s.slug}`}
                  script={s}
                  selected={selected}
                  isSeed={isSeed}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* Folha clicável de script (.py) */
function ScriptLeaf({
  script,
  selected,
  isSeed,
  onSelect,
}: {
  script: OpenCodeScript;
  selected: Selected;
  isSeed: boolean;
  onSelect: (item: SelectableItem) => void;
}) {
  const isSelected = selected?.kind === "script" && selected?.slug === script.slug;
  const sizeKb = script.size_bytes >= 1024 ? `${(script.size_bytes / 1024).toFixed(1)}kb` : `${script.size_bytes}b`;

  return (
    <button
      type="button"
      title={`${script.skill_slug}/${script.filename}  ·  ${sizeKb}`}
      className={[
        "skills-tree-row",
        "skills-tree-row--file",
        "skills-tree-row--nested",
        isSelected && "skills-tree-row--selected",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={() =>
        onSelect({
          kind: "script",
          slug: script.slug,
          description: `${script.skill_slug}/${script.filename}`,
        })
      }
      onMouseMove={(e) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
        e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
      }}
    >
      <span className="skills-tree-chevron skills-tree-chevron--spacer" aria-hidden="true" />
      <span className="skills-tree-icon">
        <FilePythonIcon size={16} glow={isSelected} />
        {isSeed && (
          <span className="skills-tree-lock-badge" aria-label="Imutável">
            <LockBadge />
          </span>
        )}
      </span>
      <span className="skills-tree-name skills-tree-name--mono">{script.filename}</span>
    </button>
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
/* IntelliforceBundle — agrupa skills intelliforce-* numa pasta sintética     */
/* -------------------------------------------------------------------------- */

function IntelliforceBundle({
  skills,
  expanded,
  selected,
  recentlyCreated,
  onToggle,
  onSelect,
}: {
  skills: OpenCodeFile[];
  expanded: boolean;
  selected: Selected;
  recentlyCreated: Set<string>;
  onToggle: () => void;
  onSelect: (file: OpenCodeFile) => void;
}) {
  const Icon = expanded ? FolderOpenIcon : FolderClosedIcon;
  return (
    <div className="skills-tree-node">
      <button
        type="button"
        className="skills-tree-row skills-tree-row--folder skills-tree-row--nested"
        onClick={onToggle}
        aria-expanded={expanded}
        title="Skills do agente Operator (system seeds)"
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
          <span className="skills-tree-lock-badge" aria-label="Imutável">
            <LockBadge />
          </span>
        </span>
        <span className="skills-tree-name skills-tree-name--mono">intelliforce</span>
        <span className="skills-tree-count">{skills.length}</span>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="children"
            className="skills-tree-children"
            {...ANIM}
            style={{ overflow: "hidden" }}
          >
            <div className="skills-tree-children-inner">
              {skills.map((f) => (
                <FileLeaf
                  key={`skill/${f.slug}`}
                  file={f}
                  filename={f.slug.replace(/^intelliforce-/, "")}
                  selected={selected}
                  recentlyCreated={recentlyCreated}
                  onSelect={onSelect}
                />
              ))}
            </div>
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
