"use client";

/**
 * Sugestões iniciais — exibidas em duas posições:
 * - Acima do composer (via <PromptSuggestions>) quando tela está vazia
 * - NÃO mais dentro do EmptyState (era central, ficava desorganizado)
 *
 * Cada uma exercita uma capacidade real do produto e funciona ponta-a-ponta
 * ao ser clicada (skills + secrets já existem).
 */
export const SUGGESTIONS = [
  "Liste tickets abertos no Zoho Desk N1/N2",
  "Manda 'sistema online' no channel Digital Employee do Teams",
  "Quais credenciais estão cadastradas no Cofre?",
  "Crie uma skill que valida CNPJ na Receita Federal",
];

export function EmptyState() {
  return (
    <div className="skills-empty">
      <div className="skills-empty-foreground">
        <h2 className="skills-empty-headline">O que vamos construir hoje?</h2>
        <p className="skills-empty-sub">
          Converse com o builder em linguagem natural — ele cria skills, agentes e scripts no
          formato OpenCode direto no filesystem.
        </p>
      </div>
    </div>
  );
}

/**
 * Linha horizontal de sugestões pra exibir LOGO ACIMA DO COMPOSER quando o
 * chat ainda está vazio. Padrão ChatGPT/Claude.ai.
 *
 * Mesmas pills que tinham antes, mas em flex-row com wrap pra adaptar a
 * larguras de tela. Hover revela radial-glow no ponto do mouse.
 */
export function PromptSuggestions({
  onSelect,
}: {
  onSelect: (text: string) => void;
}) {
  return (
    <div className="skills-prompt-suggestions" role="list">
      {SUGGESTIONS.map((s) => (
        <button
          key={s}
          type="button"
          className="skills-suggestion"
          role="listitem"
          onClick={() => onSelect(s)}
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
          {s}
        </button>
      ))}
    </div>
  );
}
