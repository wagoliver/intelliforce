/**
 * System seeds — itens imutáveis bakeados na imagem Docker.
 * Estes não podem ser editados nem excluídos via UI; tentativa retorna 403
 * no backend. Pra modificar, edita o arquivo no repo e rebuild.
 *
 * Mantém em sincronia com `SEED_SLUGS` em
 * `worker/intelliforce/api/routes/opencode.py`.
 */

const SEED_AGENTS = ["builder", "operator"] as const;

const SEED_SKILLS_LITERAL = ["karpathy-guidelines"] as const;

/**
 * Toda skill que comece com `intelliforce-` é seed (fonte: builder.md
 * "Restrições"). Lista pode crescer; verificação por prefixo é robusta.
 */
function isIntelliforceSkill(slug: string): boolean {
  return slug.startsWith("intelliforce-");
}

export type SeedKind = "agent" | "skill" | "script";

/**
 * Verifica se um item é seed (imutável).
 *
 * - agent: `builder` ou `operator`
 * - skill: `karpathy-guidelines` ou `intelliforce-*`
 * - script: pertence a uma skill seed (slug = "<skill>/<filename>")
 * - command: nunca é seed (não há commands seed atualmente)
 */
export function isSeed(kind: SeedKind | "command", slug: string): boolean {
  if (kind === "agent") {
    return (SEED_AGENTS as readonly string[]).includes(slug);
  }
  if (kind === "skill") {
    return (
      (SEED_SKILLS_LITERAL as readonly string[]).includes(slug) ||
      isIntelliforceSkill(slug)
    );
  }
  if (kind === "script") {
    // slug do script é "<skill_slug>/<filename>" — derive a skill dona
    const sepIdx = slug.indexOf("/");
    if (sepIdx === -1) return false;
    const skillSlug = slug.slice(0, sepIdx);
    return (
      (SEED_SKILLS_LITERAL as readonly string[]).includes(skillSlug) ||
      isIntelliforceSkill(skillSlug)
    );
  }
  return false;
}

/** Set de chaves "<kind>/<slug>" usado pelo FileTree. */
export const SEED_KEYS = new Set<string>([
  ...SEED_AGENTS.map((s) => `agent/${s}`),
  ...SEED_SKILLS_LITERAL.map((s) => `skill/${s}`),
  // intelliforce-* skills são detectadas dinamicamente — list só pra
  // satisfazer as 12 atuais conhecidas (FileTree ainda usa pra animação)
  "skill/intelliforce-api",
  "skill/intelliforce-discover",
  "skill/intelliforce-departments",
  "skill/intelliforce-squads",
  "skill/intelliforce-activities",
  "skill/intelliforce-agents",
  "skill/intelliforce-instances",
  "skill/intelliforce-tasks",
  "skill/intelliforce-approvals",
  "skill/intelliforce-audit",
  "skill/intelliforce-metrics",
  "skill/intelliforce-vault",
  "skill/intelliforce-teams",
]);
