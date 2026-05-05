# Evolução da Arquitetura — IntelliForce

> Documento vivo que registra a jornada de decisões arquiteturais do IntelliForce. **Não é um snapshot final** — é a memória do *como chegamos aqui* e do *o que ainda falta decidir*. Atualize sempre que uma decisão for tomada, revisada ou revertida.

**Última atualização:** 2026-05-02
**Fase atual:** 0 — Concepção / Design exploratório

---

## 1. Status atual da arquitetura (snapshot)

```
┌────────────────────────────────────────────────────────────┐
│  IntelliForce UI (Next.js)                                 │
│  ─ Painel: Login, Home, Capabilities, Department Setup     │
│  ─ Inbox de aprovações, dashboard de tarefas               │
│  Origem: design canvas exportado do Claude.ai (em design/) │
└────────────────────────────────────────────────────────────┘
                       │
                       ▼  REST / WebSocket
┌────────────────────────────────────────────────────────────┐
│  IntelliForce API (FastAPI / Python)                       │
│  ─ Auth (SSO/RBAC)            ─ Scheduler de tarefas       │
│  ─ Audit log estruturado      ─ Fila de execução           │
│  ─ Catálogo de agentes        ─ Multi-tenancy (futuro)     │
│  ─ Inbox de aprovação humana                               │
└────────────────────────────────────────────────────────────┘
                       │
                       ▼  enfileira
┌────────────────────────────────────────────────────────────┐
│  Redis (fila + cache + pub/sub)                            │
└────────────────────────────────────────────────────────────┘
                       │
                       ▼  workers consomem
┌────────────────────────────────────────────────────────────┐
│  IntelliForce Worker (Python)                              │
│  ─ Pega tarefa da fila                                     │
│  ─ Invoca OpenCode via CLI subprocess                      │
│  ─ Captura stdout/stderr                                   │
│  ─ Persiste resultado e audit em Postgres                  │
│  ─ Marca tarefa como concluída ou pausada                  │
└────────────────────────────────────────────────────────────┘
                       │
                       ▼  subprocess (mesmo container ou exec)
┌────────────────────────────────────────────────────────────┐
│  OpenCode CLI (Bun runtime)                                │
│  ─ Lê config: opencode.json + agent/ + skill/ + command/   │
│  ─ Executa o agente com prompt da tarefa                   │
│  ─ Roda os skills necessários                              │
│  ─ Imprime resultado JSON em stdout                        │
└────────────────────────────────────────────────────────────┘
                       │
                       ▼  OpenAI-compatible (rede local)
┌────────────────────────────────────────────────────────────┐
│  LM Studio (host: PC dedicado, fora do Docker)             │
│  ─ Inferência do LLM via "lm link"                         │
└────────────────────────────────────────────────────────────┘

Persistência:
┌────────────────────────────────────────────────────────────┐
│  PostgreSQL (com pgvector)                                 │
│  ─ Estado: agentes, tarefas, audit log, usuários, RBAC     │
│  ─ Vector search pra RAG quando precisarmos                │
└────────────────────────────────────────────────────────────┘

Observabilidade (planejado):
┌────────────────────────────────────────────────────────────┐
│  Langfuse — traces de LLM, custo, latência por tarefa      │
└────────────────────────────────────────────────────────────┘
```

---

## 2. Decisões já tomadas

| # | Decisão | Razão | Quando |
|---|---------|-------|--------|
| D-01 | **Abordagem design-first** — documentar visão, arquitetura conceitual e requisitos antes de codar | Reduz risco de comprometer com stack errada | 2026-05-02 |
| D-02 | **Repositório no GitHub** (`wagoliver/intelliforce`, público, MIT) | Decidido pelo usuário | 2026-05-02 |
| D-03 | **Projeto vive em `/Volumes/M4-Storage/Projetos/IntelliForce/`** seguindo padrão de outros projetos do usuário | Convenção pessoal do dev | 2026-05-02 |
| D-04 | **Mockups ficam em `design/`** (não viram `web/` direto) | Mockups são referência exploratória, não app de produção. Permite escolher stack do frontend depois | 2026-05-02 |
| D-05 | **Manter LM Studio como provider de LLM** (em vez de Ollama dentro do Compose) | Usuário quer rodar modelo em PC mais parrudo via "lm link", separando plano de inferência do plano de aplicação. Decisão técnica sólida | 2026-05-02 |
| D-06 | **OpenCode como runtime de agentes** (em vez de LangGraph) | Tem sistema de skills/agents/commands maduro que mapeia 1:1 com o nosso `agent-spec.md`. Familiaridade do usuário. Inteligência embarcada via skills | 2026-05-02 |
| D-07 | **Integração via CLI subprocess** (em vez de OpenCode HTTP API) | Mapeia natural com modelo de tarefas atômicas. Audit limpo (1 processo = 1 trail). Operação simples (sem servidor extra). Migrar pra API depois é refator pequeno | 2026-05-02 |
| D-08 | **Docker Compose como modelo de implantação** (MVP) | Simplicidade pra rodar tudo local. Migrar pra Kubernetes vem depois se necessário | 2026-05-02 |
| D-09 | **Postgres (estado transacional) + ClickHouse (dados verbosos/analíticos)** + pgvector pra RAG | Postgres pra estado consultado pela UI; ClickHouse pra stdout/stderr de execuções, eventos granulares (skill_invoked, llm_called), tokens — coisa que cresce muito e tem perfil append-only/analítico. Usuário já opera ClickHouse no scoreWise, então não é stack nova | 2026-05-02 |
| D-10 | **Redis** pra fila + cache + pub/sub | Componente comprovado, baixa fricção. Substituível por Kafka/NATS depois se precisar | 2026-05-02 |
| D-11 | **Python** como linguagem do backend (API + worker) | Ecossistema de IA é Python-first; OpenCode roda em processo separado então linguagem do worker não influencia performance do agente; FastAPI + asyncpg + redis-py + clickhouse-driver são libs maduras; latência dominada por chamadas LLM | 2026-05-02 |
| D-12 | **Backend-only no MVP** (frontend vem depois) | Permite focar na arquitetura core. Mockups em `design/` continuam servindo como referência. Frontend Next.js entra na próxima fase | 2026-05-02 |
| D-13 | **OpenCode em container parametrizado** já configurado com provider (LM Studio) e tudo funcionando ao subir | Container nasce pronto pra uso, sem setup manual. Reproduzível em qualquer máquina via `docker compose up` | 2026-05-02 |
| D-14 | **APScheduler embutido** no processo Python (em vez de Celery Beat) | Sem infra extra pro MVP. Migra pra Celery Beat se precisar de robustez maior | 2026-05-02 |
| D-15 | **Agentes definidos de forma declarativa** (markdown em `agent/<nome>.md` no formato OpenCode) | Consequência natural da escolha do OpenCode como runtime. Permite que dev de domínio configure agente sem programar | 2026-05-02 |
| D-16 | **Observabilidade (Langfuse) entra depois do MVP** | MVP foca no core. Audit já vem natural via tabela `events` + ClickHouse | 2026-05-02 |
| D-17 | **Triggers no MVP: API + scheduler** (mínimo funcional) | Cobre >80% dos casos. Webhooks e composição agente-agente vêm na Fase 3 | 2026-05-02 |
| D-18 | **Container único worker + OpenCode CLI** (em vez de separados) | Sem rede entre eles, build/deploy mais simples. Separar depois se workers precisarem escalar diferente do OpenCode | 2026-05-02 |

---

## 3. Decisões em aberto

| # | Decisão | Status | Bloqueia |
|---|---------|--------|----------|
| O-03 | Stack do frontend (Next.js + Tailwind vs alternativa) | Pós-MVP | Implementação da UI |
| O-04 | Multi-tenancy desde dia 1 ou depois | **Pós-MVP** | Schema do Postgres |

---

## 4. Histórico das discussões — como chegamos aqui

### 4.1 — Ponto de partida: visão design-first

**Discussão:** o usuário queria começar o projeto, mas sem stack definida. Decidimos por uma abordagem *design-first*: consolidar visão, princípios, arquitetura conceitual e requisitos **antes** de escrever código.

**Resultado:** criados `docs/vision.md`, `docs/architecture.md`, `docs/agent-spec.md`, `docs/requirements.md`, `docs/roadmap.md`, `docs/glossary.md`. Total ~890 linhas de documentação fundadora.

### 4.2 — Mockups: design canvas do Claude.ai

**Discussão:** o usuário trabalhou no Claude.ai criando mockups (design canvas) e exportou um pacote completo: 7 HTMLs + 13 JSXs + 5 CSSs. Foi colocado inicialmente em `IntelliForce/IntelliForce/`, depois renomeado para `IntelliForce/design/` (`IntelliForce/IntelliForce/` era confuso por nome duplicado, e `UI/` era genérico demais).

**Resultado:** pasta `design/` é a fonte da verdade visual. **Não vai pra produção como está** (usa Babel standalone via CDN — só serve pra preview rápido). Quando entrar a Fase 2 (Walking Skeleton), os componentes bons serão portados pra um projeto Next.js em `web/`.

### 4.3 — Backend, DB e processamento: discussão da stack

**Discussão:** o usuário pediu pra pensar em backend, DB e camadas de processamento, tudo em Docker Compose. Sua intuição inicial: agentes rodam no OpenCode, LLM provider é o LM Studio.

**Reflexão crítica feita:**

- Sobre **LM Studio**: inicialmente sugeri trocar por Ollama (mais "container-friendly"), mas o usuário tinha razão técnica forte — quer rodar modelo em PC mais parrudo via `lm link` e servir pra Mac mini que hospeda a plataforma. Isso é arquitetura distribuída sensata. **Mantido LM Studio.**
  - Riscos a mitigar: SPOF (PC do LM Studio cair), concorrência limitada, sem observabilidade nativa
  - Mitigação: construir um **`model_gateway`** dentro do código com retry/timeout/fallback, abstraindo o provider — interface OpenAI-compatible permite trocar amanhã sem refatorar código de aplicação

- Sobre **OpenCode**: inicialmente argumentei que OpenCode era "para coding" e não pra workforce agents. **Estava errado** — quando o usuário aplica skills e tools customizadas, OpenCode raciocina sobre qualquer domínio. A discussão real não era "qual é mais capaz", mas "qual paradigma combina com cada tipo de agente":
  - **Padrão autônomo** (OpenCode-style, ReAct): LLM é o orquestrador, decide caminho a cada turno. Bom pra tarefas exploratórias/variadas.
  - **Padrão estruturado** (LangGraph com graph): dev desenha o grafo, LLM é chamado em nós específicos. Bom pra workflows repetíveis com compliance estrito.
  - LangGraph **também faz autônomo** via `create_react_agent`, mas força a escolha por agente.

### 4.4 — A virada: OpenCode tem sistema de skills maduro

**Discussão:** o usuário esclareceu que "inteligência embarcada" do OpenCode é via skills + tools customizadas, não inteligência hard-coded de coding. **Pesquisa confirmou** que OpenCode tem sistema completo:

- **Skills** (`skill/<nome>/SKILL.md`) — capacidades reutilizáveis com frontmatter, scripts, references, assets. Progressive disclosure: só metadados carregam, conteúdo completo só quando o agente decide usar.
- **Agents** (`agent/<nome>.md`) — papéis com prompt, mode (`primary` / `subagent` / `all`), tools, model. Composição via subagent.
- **Commands** (`command/<nome>.md`) — gatilhos slash com `agent:`, `$ARGUMENTS`, `!`bash`` injection.
- **MCP servers** e **custom tools** via `opencode.json` pra integrações.

**Mapeamento perfeito com nosso `agent-spec.md`:**

| Conceito IntelliForce | OpenCode |
|----------------------|----------|
| Funcionário Virtual | Agent |
| Capacidade | Skill |
| Trigger UI | Command |
| Política `allowed-tools` | `allowed-tools:` no SKILL.md |
| Composição | Subagent |
| Escolha de modelo | `model:` no agent |

**Decisão:** OpenCode é o runtime de agentes do IntelliForce.

### 4.5 — Como integrar: HTTP API vs CLI subprocess

**Discussão:** OpenCode oferece duas formas de integração programática:

1. **API HTTP** (`opencode serve`): bom pra streaming, sessões longas, chat interativo
2. **CLI non-interactive** (`opencode -p "..." -f json -q`): bom pra batch, isolamento por tarefa, audit limpo

**Análise:** pra workforce agents do IntelliForce — que executam tarefas atômicas atribuídas via fila — **CLI é melhor**:

- 1 processo por tarefa = audit trail trivial
- Sem servidor HTTP extra pra manter
- Cancelamento via `subprocess.kill()` ou `timeout=N`
- Debug é executar o mesmo comando no shell
- CLI é interface mais estável que API REST
- Migrar pra HTTP depois (se precisar streaming pra UI) é refator pequeno

**Trade-off aceito:** ~200ms de overhead de startup do Bun por tarefa. Aceitável pra escala MVP (dezenas de tarefas/min). Pra alta vazão (centenas/seg) reavaliar.

**Human-in-loop com CLI:** o estado vive no Postgres do IntelliForce, não no OpenCode. Cada CLI invocation = pedaço atômico do workflow. Quando precisa aprovação, o IntelliForce marca tarefa como `awaiting_approval`, processo CLI termina. Quando humano aprova, IntelliForce dispara nova invocação CLI com contexto da anterior. **OpenCode nem sabe que existe aprovação humana** — separação de preocupações limpa.

### 4.6 — Estrutura final do repositório (proposta)

```
IntelliForce/
├── README.md
├── docs/                       ← documentação fundadora
│   ├── vision.md
│   ├── architecture.md
│   ├── agent-spec.md
│   ├── requirements.md
│   ├── roadmap.md
│   ├── glossary.md
│   └── architecture-evolution.md  ← este documento
├── design/                     ← mockups exportados do Claude.ai
├── opencode/                   ← coração da inteligência da plataforma
│   ├── opencode.json           ← config geral, MCPs, tools
│   ├── agent/                  ← funcionários virtuais
│   ├── skill/                  ← capacidades reutilizáveis
│   └── command/                ← gatilhos slash
├── api/                        ← FastAPI: auth, agentes, tarefas, audit
├── worker/                     ← consumer da fila, invoca OpenCode CLI
├── web/                        ← Next.js: porta dos mockups + UI real
├── infrastructure/
│   ├── docker-compose.yml      ← orquestra tudo
│   └── Dockerfile.*            ← imagens dos serviços
├── tests/
└── scripts/
```

---

## 5. Princípios arquiteturais consolidados

Surgidos das discussões. Quando estiver em dúvida, volte aqui:

1. **Inteligência de domínio é nossa, plumbing é dos outros.** OpenCode/LangGraph fazem a camada técnica. Skills, agents e business rules são o produto IntelliForce.

2. **CLI > API quando der.** Interfaces de processo são mais estáveis, mais auditáveis e mais Unix-friendly que APIs REST evoluindo.

3. **Estado da plataforma vive no Postgres do IntelliForce.** OpenCode é stateless do ponto de vista da plataforma — cada invocação é atômica. O fluxo multi-passo é responsabilidade nossa.

4. **Provider de LLM é abstração.** Código nunca conversa direto com LM Studio/Anthropic/OpenAI — sempre via `model_gateway` interno. Trocar provider deve ser flag de ambiente.

5. **Cada componente pode ser substituído.** Postgres → MongoDB? Refator. OpenCode → LangGraph? Refator. LM Studio → vLLM? Mudança de URL. Nenhuma decisão é forever-and-ever.

6. **Auditoria é primeira classe, não retroativa.** Toda invocação de agente, toda tool call, toda decisão humana é persistida desde o dia 1. Compliance não é coisa de versão 2.0.

7. **Configuração declarativa antes de código imperativo.** Agentes, skills, comandos são markdown/JSON. Código Python só pra plataforma. Dev de domínio não precisa programar.

8. **Soft delete em entidades referenciadas por audit.** Toda entidade que é apontada por FK de tabelas event-sourced (tasks, events, audit logs, etc.) usa soft delete (`is_active=false`) em vez de hard delete físico. Hard delete destruiria trilha de auditoria. Aplicado em: `agents`, `departments`, `squads`, `activities`. Pra remover dados de verdade (LGPD/retenção), criar task administrativa explícita que arquiva tasks históricas antes. Defesa em profundidade: middleware global no FastAPI converte `IntegrityError` (FK violation) em 409 amigável, garantindo que endpoints futuros que esquecerem o padrão não derrubem o usuário com 500.

---

## 6. Próximos passos sugeridos

Em ordem:

1. **Validar este documento** — ler tudo e confirmar/corrigir.
2. **Criar `docs/opencode-guide.md`** consolidando como skills/agents/commands funcionam (referência canônica do time).
3. **Esboçar estrutura `opencode/`** com 1 skill exemplo + 1 agent exemplo + 1 command exemplo.
4. **Setup inicial do OpenCode local** no Mac mini do dev pra validar invocação CLI manualmente (sem container ainda).
5. **Primeiro spike:** rodar `opencode -p "tarefa exemplo" --agent <nome> -f json` apontando pro LM Studio e ver o ciclo end-to-end funcionando.
6. **Definir schema inicial do Postgres** (tabelas: `agents`, `tasks`, `audit_events`, `users`, `tenants`).
7. **Esboçar `docker-compose.yml`** com Postgres + Redis + worker + (opencode mesma imagem ou separado).
8. **Primeiro agente real** — escolher um caso de uso simples (ex: triagem de chamados ITSM) e construir end-to-end.

---

## 7. Glossário rápido

Termos usados neste documento. Glossário completo em [`glossary.md`](./glossary.md).

- **Skill (OpenCode)** — capacidade reutilizável definida em `skill/<nome>/SKILL.md`
- **Agent (OpenCode)** — papel/funcionário virtual definido em `agent/<nome>.md`
- **Command (OpenCode)** — gatilho slash definido em `command/<nome>.md`
- **Worker** — processo Python que consome fila e invoca OpenCode CLI
- **Scheduler** — componente que cria tarefas em horários programados (cron-like)
- **lm link** — feature do LM Studio que permite servir modelo via rede pra outros dispositivos
- **Progressive disclosure** — padrão do OpenCode onde só metadados de skills carregam no contexto inicial; conteúdo completo só quando o agente decide usar
- **CLI subprocess pattern** — padrão de integração onde uma aplicação invoca um binário externo (OpenCode) como processo filho, capturando stdout/stderr

---

## 8. Como manter este documento

- **Sempre que tomar uma decisão arquitetural**, adicionar na tabela §2 e narrar a discussão em §4
- **Sempre que reverter uma decisão**, marcar em §2 com nota e mover pra §4 com explicação
- **Sempre que o diagrama §1 mudar**, atualizar primeiro aqui antes de codar
- **Sempre que abrir nova decisão**, adicionar em §3 com o que ela bloqueia
- **Quando uma decisão estiver suficientemente madura**, considerar promover pra um ADR formal em `docs/adr/NNNN-titulo.md`

---

## Referências

- [Visão e princípios](./vision.md)
- [Arquitetura conceitual](./architecture.md)
- [Especificação dos agentes](./agent-spec.md)
- [Requisitos](./requirements.md)
- [Roadmap](./roadmap.md)
- [Mockups visuais](../design/README.md)
