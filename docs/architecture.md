# Arquitetura Conceitual do IntelliForce

> Este documento descreve a arquitetura **conceitual** da plataforma — agnóstica de stack tecnológica. Decisões de implementação (linguagens, frameworks, banco de dados, orquestrador) serão documentadas em ADRs (Architecture Decision Records) na pasta `docs/adr/` quando forem tomadas.

## Camadas da Plataforma

```
┌─────────────────────────────────────────────────────────────┐
│                  Painel de Controle (UI)                     │
│   - Catálogo de agentes      - Métricas e observabilidade    │
│   - Gestão de tarefas        - Auditoria e logs              │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                       API Pública                            │
│   - REST / GraphQL para integrações externas                 │
│   - Autenticação e autorização (RBAC)                        │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                  Núcleo de Orquestração                      │
│   ┌───────────────┐  ┌───────────────┐  ┌────────────────┐  │
│   │   Scheduler   │  │   Executor    │  │   Supervisor   │  │
│   │  (filas, cron)│  │  (runtime)    │  │ (humano-in-loop)│ │
│   └───────────────┘  └───────────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│              Funcionários Virtuais (Agentes)                 │
│   Cada agente = papel + capacidades + políticas + métricas   │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│            Capacidades / Ferramentas / Integrações           │
│   ┌──────────┐  ┌─────────┐  ┌────────┐  ┌──────────────┐   │
│   │   LLMs   │  │   RAG   │  │  APIs  │  │  Bancos /    │   │
│   │ (Claude, │  │(Embeddi-│  │(CRM,   │  │  Sistemas    │   │
│   │  GPT...) │  │ ngs/Vec)│  │ ERP...)│  │  Internos    │   │
│   └──────────┘  └─────────┘  └────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│           Observabilidade e Governança (transversal)         │
│   - Traces de execução  - Logs estruturados                  │
│   - Métricas            - Trilha de auditoria                │
└─────────────────────────────────────────────────────────────┘
```

## Conceitos-chave

### Agente (Funcionário Virtual)

Unidade de execução. Tem:

- **Identidade** (nome, papel, descrição)
- **Capacidades** (ferramentas/integrações que pode usar)
- **Políticas** (limites, aprovações necessárias, horários)
- **Contrato** (entradas esperadas, saídas garantidas, SLA)
- **Métricas** (tarefas executadas, taxa de sucesso, tempo médio)

Veja a [especificação completa](./agent-spec.md).

### Tarefa

Unidade de trabalho atribuída a um agente. Tem:

- **Origem** (gatilho: API, schedule, evento, humano)
- **Contexto** (dados de entrada)
- **Estado** (pendente, em execução, aguardando aprovação, concluída, falhou)
- **Histórico** (cada passo dado pelo agente)
- **Resultado** (saída + artefatos gerados)

### Capacidade (Tool / Integration)

Função discreta que o agente pode invocar. Pode ser:

- Chamada a uma LLM (geração, classificação, extração)
- Chamada a uma API externa (CRM, ERP, e-mail)
- Operação em banco interno
- Outro agente (composição)

Capacidades são **reutilizáveis entre agentes** e versionadas.

### Política

Regras que governam o que um agente pode/deve fazer:

- Limites de gasto (tokens, chamadas, custo)
- Pontos de aprovação humana (ex: antes de enviar e-mail externo)
- Horários permitidos
- Dados que pode acessar (RBAC)
- Comportamento em caso de erro (retry, escalar, parar)

### Supervisor

Componente que media a interação humano-agente:

- Notifica humanos quando aprovação é necessária
- Permite override e intervenção manual
- Coleta feedback para melhoria contínua

## Padrões Arquiteturais Adotados

### 1. Event-driven core

Tarefas, transições de estado e ações de agentes são **eventos** persistidos. Permite:

- Auditoria nativa (event sourcing)
- Reprocessamento e replay
- Desacoplamento entre componentes

### 2. Capacidades como contratos

Cada capacidade tem **schema explícito** (entrada/saída) e é descoberta em runtime pelo agente. Isso permite trocar implementação sem alterar o agente.

### 3. Agente = Configuração + Runtime

Agentes não são código de produção — são **configurações** declarativas (papel, capacidades, políticas) interpretadas por um runtime genérico. Adicionar um novo agente não exige deploy.

### 4. Observabilidade transversal

Logging, tracing e métricas são **infraestrutura**, não responsabilidade do agente. Toda chamada a uma capacidade é instrumentada automaticamente.

## Decisões em Aberto (a virarem ADRs)

| # | Decisão | Status |
|---|---------|--------|
| 1 | Linguagem do núcleo (Python vs. Node vs. Go) | Pendente |
| 2 | Framework de orquestração (LangGraph vs. próprio vs. Temporal) | Pendente |
| 3 | Persistência (PostgreSQL vs. Mongo vs. híbrido) | Pendente |
| 4 | Mensageria (Kafka vs. Redis Streams vs. SQS) | Pendente |
| 5 | Stack do painel (Next.js vs. Nuxt vs. SPA simples) | Pendente |
| 6 | Modelo de implantação (cloud-managed vs. self-hosted vs. híbrido) | Pendente |
| 7 | LLMs primários e estratégia multi-provider | Pendente |
| 8 | Vector store para RAG | Pendente |

Cada uma virará um ADR em `docs/adr/NNNN-titulo.md` quando for decidida.
