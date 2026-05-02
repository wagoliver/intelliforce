# Contribuindo com o IntelliForce

> Convenções de trabalho do projeto. Mantenha este documento curto e atualizado.

## Status do Projeto

O IntelliForce está em **fase de concepção**. Contribuições nesta fase são principalmente:

- Discussões sobre visão e arquitetura
- Refinamento de documentos em `docs/`
- Identificação de casos de uso piloto
- Validação com stakeholders

Contribuições de **código** ainda não são esperadas — a stack tecnológica não foi escolhida. Veja o [roadmap](./docs/roadmap.md).

---

## Branches

- **`main`** — branch principal, sempre estável
- **`docs/<assunto>`** — alterações em documentação (ex: `docs/refine-architecture`)
- **`spike/<nome>`** — investigações técnicas descartáveis
- **`feat/<nome>`** — features (a partir da Fase 2)
- **`fix/<nome>`** — correções (a partir da Fase 2)

## Commits

Adotamos [Conventional Commits](https://www.conventionalcommits.org/):

```
<tipo>(<escopo opcional>): <descrição em imperativo>

[corpo opcional]

[rodapé opcional]
```

**Tipos comuns:**

- `feat` — nova funcionalidade
- `fix` — correção de bug
- `docs` — apenas documentação
- `refactor` — refatoração sem mudança de comportamento
- `test` — adição/ajuste de testes
- `chore` — tarefas de manutenção (deps, build, configs)
- `spike` — investigação técnica

**Exemplos:**

```
docs(architecture): adiciona diagrama de camadas
docs(agent-spec): refina seção de políticas de escalonamento
chore: adiciona arquivo .editorconfig
spike(orchestration): testa LangGraph para state machine de tarefa
```

## Pull Requests

- Título do PR segue o mesmo padrão dos commits
- Descrição responde: **o que mudou**, **por quê**, **como testar**
- Para mudanças em `docs/`, peça revisão de pelo menos uma pessoa do time fundador
- ADRs precisam de aprovação explícita antes de merge

## ADRs (Architecture Decision Records)

Decisões arquiteturais importantes são registradas em `docs/adr/NNNN-titulo.md`. Use o template (a criar) e siga o formato:

1. **Contexto** — qual problema motivou a decisão
2. **Opções consideradas** — alternativas avaliadas
3. **Decisão** — o que foi decidido
4. **Consequências** — trade-offs aceitos

## Estrutura de Pastas

Veja o [README](./README.md#-estrutura-do-repositório).

## Comunicação

Discussões fora do código acontecem em (definir canal — Slack, Discord, etc.).
