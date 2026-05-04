/**
 * Slash commands disponíveis no chat do Command Center.
 *
 * Cada comando vira um template de prompt quando selecionado — o user pode
 * editar antes de enviar. Filtrados por agente atual.
 *
 * Comandos com `local: true` executam só no frontend (ex: /clear, /help) e
 * não viram template enviável.
 */

export type SlashAgent = "operator" | "builder" | "both";

export type SlashCommand = {
  slug: string;
  label: string;
  description: string;
  template: string;
  agents: SlashAgent;
  /** True se executa só no frontend (não envia ao chat) */
  local?: boolean;
};

export const SLASH_COMMANDS: SlashCommand[] = [
  // ============== OPERATOR ==============
  {
    slug: "me",
    label: "/me",
    description: "Quem sou eu no sistema?",
    template: "Quem sou eu logado no sistema agora?",
    agents: "operator",
  },
  {
    slug: "state",
    label: "/state",
    description: "Estado completo: deps, employees, atividades, tasks recentes",
    template: "Mostre o estado atual completo do IntelliForce — departamentos, digital employees, atividades e últimas tarefas executadas.",
    agents: "operator",
  },
  {
    slug: "depts",
    label: "/depts",
    description: "Lista departamentos com squads e atividades",
    template: "Lista os departamentos do sistema com seus squads e atividades.",
    agents: "operator",
  },
  {
    slug: "employees",
    label: "/employees",
    description: "Lista os digital employees cadastrados",
    template: "Lista os digital employees (agents) cadastrados no sistema.",
    agents: "operator",
  },
  {
    slug: "tasks",
    label: "/tasks",
    description: "Últimas tarefas executadas",
    template: "Mostre as últimas 20 tarefas executadas, com status e duração.",
    agents: "operator",
  },
  {
    slug: "approvals",
    label: "/approvals",
    description: "Aprovações pendentes na inbox",
    template: "Tem aprovações pendentes? Lista a inbox.",
    agents: "operator",
  },
  {
    slug: "cost",
    label: "/cost",
    description: "Custo total dos últimos 30 dias",
    template: "Mostre o custo agregado do sistema nos últimos 30 dias.",
    agents: "operator",
  },
  {
    slug: "new-dept",
    label: "/new-dept",
    description: "Criar departamento novo (com perguntas guiadas)",
    template: "Quero criar um departamento novo. Faça as perguntas que precisar (nome, objetivo, owner) antes de criar.",
    agents: "operator",
  },
  {
    slug: "new-activity",
    label: "/new-activity",
    description: "Criar atividade nova (incluindo cron schedule)",
    template: "Quero criar uma atividade nova num squad existente. Pergunte qual squad, schedule cron, target de instâncias, etc.",
    agents: "operator",
  },
  {
    slug: "new-employee",
    label: "/new-employee",
    description: "Criar digital employee + alocar em activity",
    template: "Quero criar um digital employee novo e alocá-lo numa atividade. Pergunte os detalhes (nome, modelo, qual activity, quantos instâncias).",
    agents: "operator",
  },

  // ============== BUILDER ==============
  {
    slug: "new-skill",
    label: "/new-skill",
    description: "Criar skill nova (com perguntas guiadas)",
    template: "Quero criar uma skill nova. Pergunte o que ela deve fazer, que tools precisa, e gere o SKILL.md + scripts auxiliares se for o caso.",
    agents: "builder",
  },
  {
    slug: "new-agent",
    label: "/new-agent",
    description: "Criar agente novo em opencode/.opencode/agents/",
    template: "Quero criar um agente novo. Pergunte o papel (role), modelo, tools necessárias, e gere o agent.md.",
    agents: "builder",
  },
  {
    slug: "files",
    label: "/files",
    description: "Listar estrutura de opencode/.opencode/",
    template: "Lista a estrutura atual de opencode/.opencode/ — quais agentes, skills e commands existem.",
    agents: "builder",
  },

  // ============== BOTH ==============
  {
    slug: "help",
    label: "/help",
    description: "Mostra os comandos disponíveis",
    template: "Liste todos os comandos slash disponíveis pra mim no agente atual e o que cada um faz.",
    agents: "both",
  },
];

export function commandsForAgent(agent: "operator" | "builder"): SlashCommand[] {
  return SLASH_COMMANDS.filter((c) => c.agents === "both" || c.agents === agent);
}

export function filterCommands(
  commands: SlashCommand[],
  query: string,
): SlashCommand[] {
  if (!query) return commands;
  const q = query.toLowerCase();
  return commands.filter(
    (c) => c.slug.toLowerCase().includes(q) || c.label.toLowerCase().includes(q),
  );
}
