# Attribution — skills externas

Este arquivo lista skills que **não foram criadas neste repositório** e suas
respectivas fontes/licenças. Skills criadas internamente pelo time IntelliForce
não precisam aparecer aqui.

OpenCode CLI ignora este arquivo (não tem estrutura `<pasta>/SKILL.md`).

## karpathy-guidelines

- **Pasta:** `karpathy-guidelines/`
- **Fonte:** https://github.com/forrestchang/andrej-karpathy-skills
- **Licença:** MIT
- **Importado em:** 2026-05-03 (commit `f8dbdc4`)
- **Conteúdo:** verbatim — nenhuma alteração no `SKILL.md` original
- **Por quê:** guidelines comportamentais (4 princípios) pra reduzir erros
  comuns de LLM em coding. Útil como referência consultada pelo agente
  `builder` quando vai gerar código novo de skill ou agente.

---

## Convenção pra novas skills externas

Quando importar mais uma skill de fora do projeto:

1. Copia o `SKILL.md` (ou pasta inteira se tiver `scripts/`) **verbatim** pra
   `opencode/.opencode/skills/<nome>/`.
2. Adiciona uma entrada acima com:
   - Pasta · Fonte (URL) · Licença · Data de import + commit hash · Por quê.
3. Se a licença não for MIT/Apache/BSD permissivas, **revisar antes** —
   algumas licenças (GPL, AGPL, CC-BY-NC) trazem obrigações virais ou
   restrições que podem entrar em conflito com o licenciamento do projeto.
4. Se modificar o `SKILL.md` original, registrar **as mudanças** nesta
   entrada (em vez de "verbatim").
