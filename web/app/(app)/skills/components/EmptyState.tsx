"use client";

const SUGGESTIONS = [
  "Crie uma skill que valida CNPJ na Receita Federal",
  "Crie uma skill que envia notificação no Slack",
  "Mostre quais skills já existem no projeto",
  "Leia o agente builder e me explique o que ele faz",
];

export function EmptyState({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  return (
    <div className="skills-empty">
      <div className="skills-empty-icon" aria-hidden="true">
        <svg width={28} height={28} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12 3l1.8 5.4L19 10l-4.6 3.2L16 19l-4-3-4 3 1.6-5.8L5 10l5.2-1.6L12 3z"
            stroke="currentColor"
            strokeWidth="1.6"
            fill="none"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
        <h2 className="skills-empty-headline">What do you want to build?</h2>
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
  );
}
