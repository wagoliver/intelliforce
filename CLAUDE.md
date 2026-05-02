# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status do projeto — leia primeiro

O IntelliForce está na **Fase 0 — Concepção** (ver [docs/roadmap.md](./docs/roadmap.md)). **Não existe código de produção ainda** e nenhuma stack está em uso no repositório:

- `src/` está intencionalmente vazio (subpastas `agents/`, `core/`, `integrations/`, `api/` são placeholders descritos em [src/README.md](./src/README.md)).
- `tests/`, `scripts/` e `infrastructure/` estão vazios.
- Não há `package.json`, `pyproject.toml`, `Dockerfile`, lint config ou test runner. Comandos de build/test/lint **ainda não existem** — não invente. Se o usuário pedir para rodar testes ou build, confirme antes que a Fase 2 (Walking Skeleton) já começou.

A maior parte das contribuições nesta fase é em `docs/` (refino de visão, arquitetura, requisitos) e em ADRs futuras.

## Documento canônico — `docs/architecture-evolution.md`

Este é o **mais importante** arquivo do repo. É a memória viva das decisões arquiteturais: o que foi decidido (§2, decisões D-01 a D-18), o que está em aberto (§3), e a narrativa de *como chegamos aqui* (§4). Sempre consulte antes de sugerir mudança de stack ou desenho — várias alternativas óbvias (Ollama em vez de LM Studio, LangGraph em vez de OpenCode, HTTP API em vez de CLI subprocess) já foram avaliadas e descartadas com razão registrada.

Quando uma decisão arquitetural nova é tomada, atualize §1 (diagrama), §2 (tabela) e §4 (narrativa) **antes** de propor código.

## Stack escolhida (decidida, não implementada)

Conforme `docs/architecture-evolution.md`:

- **Backend**: Python (FastAPI) — API + worker — D-11
- **Runtime de agentes**: [OpenCode](https://opencode.ai) CLI (Bun), invocado via `subprocess` — D-06, D-07
- **Provider de LLM**: LM Studio servindo via "lm link" para um host com mais GPU; código nunca conversa direto — sempre via abstração interna `model_gateway` (Princípio §5.4)
- **Persistência**: Postgres (estado transacional, com pgvector) + ClickHouse (eventos verbosos / append-only) — D-09
- **Fila / cache / pub-sub**: Redis — D-10
- **Scheduler**: APScheduler embutido no processo Python (não Celery Beat no MVP) — D-14
- **Deploy**: Docker Compose para o MVP — D-08
- **Frontend**: backend-only no MVP; mockups em `design/` viram `web/` (provavelmente Next.js) na próxima fase — D-12, O-03
- **Observabilidade (Langfuse)**: pós-MVP — D-16

## Estrutura planejada do repo

A estrutura **proposta** (architecture-evolution §4.6) que substituirá o `src/` placeholder quando a Fase 2 começar:

```
IntelliForce/
├── docs/             # documentação fundadora (existe)
├── design/           # mockups Claude.ai exportados (existe)
├── opencode/         # ★ coração: opencode.json + agent/ + skill/ + command/
├── api/              # FastAPI (auth, agentes, tarefas, audit)
├── worker/           # consumer da fila, invoca OpenCode CLI
├── web/              # Next.js (porta dos mockups)
├── infrastructure/   # docker-compose.yml + Dockerfiles
├── tests/
└── scripts/
```

A pasta `src/` atual será **descartada/renomeada** — não escreva código novo dentro dela sem confirmar.

## Conceitos centrais (necessários para entender qualquer mudança)

- **Funcionário Virtual (Agent)** — papel + capacidades + políticas + contrato + métricas. Definido **declarativamente** em markdown no formato OpenCode (`agent/<nome>.md`). Adicionar agente novo não exige deploy. Detalhe completo em [docs/agent-spec.md](./docs/agent-spec.md).
- **Capacidade (Skill / Tool)** — função discreta reutilizável entre agentes. No OpenCode mapeia para `skill/<nome>/SKILL.md` (progressive disclosure: só metadados carregam; conteúdo só quando o agente decide usar).
- **Tarefa** — unidade de trabalho com estado persistido em Postgres. Cada invocação de OpenCode CLI = 1 pedaço atômico do workflow. **Multi-step e human-in-loop são responsabilidade do IntelliForce**, não do OpenCode (architecture-evolution §4.5).
- **Eventos como auditoria nativa** — toda transição/ação é evento persistido (event sourcing). Auditoria é primeira classe desde o dia 1, não retroativa.

Mapeamento conceitual IntelliForce ↔ OpenCode (architecture-evolution §4.4): Funcionário Virtual = Agent · Capacidade = Skill · Trigger UI = Command · Composição = Subagent.

## Princípios arquiteturais (architecture-evolution §5)

Apliquem em decisões de design:

1. **Inteligência de domínio é nossa, plumbing é dos outros** — OpenCode/LangGraph fazem a camada técnica; skills + business rules são o produto.
2. **CLI > API quando der** — interfaces de processo são mais estáveis e auditáveis.
3. **Estado vive no Postgres do IntelliForce** — OpenCode é stateless do ponto de vista da plataforma.
4. **Provider de LLM é abstração** — tudo via `model_gateway`; trocar provider deve ser flag de ambiente.
5. **Cada componente substituível** — nenhuma decisão é forever-and-ever.
6. **Auditoria é primeira classe**, não retroativa.
7. **Configuração declarativa antes de código imperativo** — agentes/skills/commands são markdown/JSON; código Python só para a plataforma.

## Pasta `design/`

Mockups exportados do Claude.ai design canvas (HTML + JSX + CSS via Babel standalone CDN). É **referência visual**, nunca produção:

```bash
cd design && python3 -m http.server 8000
# http://localhost:8000/Login.html
```

Não levar para produção: `<script type="text/babel">`, CDN do Babel, e os utilitários de canvas (`design-canvas.jsx`, `logo-canvas.jsx`, `notched-canvas.jsx`, `tweaks-panel.jsx`, `stage.jsx`, pasta `scraps/`).

## Convenções de contribuição

Detalhes em [CONTRIBUTING.md](./CONTRIBUTING.md). Pontos críticos:

- **Conventional Commits** — `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `spike:`. Mensagens em **português**, imperativo. O resto da documentação também é em PT-BR — siga o idioma.
- **Branches** — `docs/<assunto>` para mudanças em docs; `spike/<nome>` para investigações descartáveis; `feat/<nome>` e `fix/<nome>` só a partir da Fase 2.
- **ADRs** — decisões arquiteturais importantes vão em `docs/adr/NNNN-titulo.md` (pasta a criar) com as 4 seções: Contexto, Opções consideradas, Decisão, Consequências. ADR precisa de aprovação explícita antes de merge.
- **PRs em `docs/`** — pedir revisão de pelo menos uma pessoa do time fundador.

## O que evitar

- **Não comece a codar produção sem confirmar** que a Fase 1 (ADRs aprovadas) e Fase 2 começaram. O roadmap exige que cada fase termine antes da próxima.
- **Não sugira trocar OpenCode, LM Studio ou CLI-subprocess** sem ler a discussão em architecture-evolution §4 — esses caminhos foram descartados com razão técnica registrada.
- **Não confunda `src/` com `opencode/` + `api/` + `worker/` + `web/`** — `src/` é um placeholder histórico e provavelmente sumirá na reestruturação da Fase 2.
- **Não trate `design/` como app real** — é canvas exploratório.
