"use client";

const SUGGESTIONS = [
  "Liste tickets abertos no Zoho Desk N1/N2",
  "Manda 'sistema online' no channel Digital Employee do Teams",
  "Quais credenciais estão cadastradas no Cofre?",
  "Crie uma skill que valida CNPJ na Receita Federal",
];

export function EmptyState({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  return (
    <div className="skills-empty">
      <div className="skills-empty-foreground">
        <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
          <h2 className="skills-empty-headline">O que vamos construir hoje?</h2>
          <p className="skills-empty-sub">
            Converse com o builder em linguagem natural — ele cria skills, agentes e scripts no
            formato OpenCode direto no filesystem.
          </p>
        </div>

        <div className="skills-suggestions">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              className="skills-suggestion"
              onClick={() => onSuggestion(s)}
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
      </div>
    </div>
  );
}
