# Roadmap do IntelliForce

> Visão de fases do projeto. Datas são alvos, não compromissos.

## Estado atual: **Fase 0 — Concepção**

---

## Fase 0 — Concepção (atual)

**Objetivo:** consolidar o desenho conceitual antes de escrever uma linha de código de produção.

**Entregáveis:**

- [x] README com visão e status
- [x] Documento de visão e princípios
- [x] Arquitetura conceitual
- [x] Especificação dos funcionários virtuais
- [x] Lista inicial de requisitos
- [ ] Validação com 2-3 stakeholders internos
- [ ] Definição de casos de uso piloto (2-3 agentes-alvo)
- [ ] Mockups de baixa fidelidade do painel

**Critério de saída:** stakeholders alinhados sobre o que o IntelliForce é e o que **não** é. Casos de uso piloto definidos.

---

## Fase 1 — Decisões Arquiteturais

**Objetivo:** transformar o desenho conceitual em decisões implementáveis.

**Entregáveis:**

- [ ] ADR 0001 — Linguagem e runtime do núcleo
- [ ] ADR 0002 — Estratégia de orquestração e estado
- [ ] ADR 0003 — Persistência e mensageria
- [ ] ADR 0004 — Stack do painel
- [ ] ADR 0005 — Estratégia multi-LLM
- [ ] ADR 0006 — Modelo de deploy (cloud / on-prem / híbrido)
- [ ] Spike técnico de cada decisão crítica
- [ ] Estimativa de custo de infra por escala

**Critério de saída:** todas as ADRs aprovadas. Spikes mostram viabilidade técnica.

---

## Fase 2 — Walking Skeleton

**Objetivo:** uma versão *end-to-end* mínima da plataforma rodando, mesmo que com features fake.

**Entregáveis:**

- [ ] Núcleo de orquestração com state machine de tarefa
- [ ] Um tipo de capacidade implementado (LLM call)
- [ ] Um agente exemplo configurável
- [ ] API para atribuir tarefa e consultar estado
- [ ] Persistência de tarefas e logs
- [ ] CLI mínimo para operação
- [ ] CI/CD pipeline base
- [ ] Containerização

**Critério de saída:** é possível criar um agente, atribuir uma tarefa, ver o resultado e auditar a execução. Stack escolhida está em uso.

---

## Fase 3 — MVP

**Objetivo:** primeira versão utilizável internamente em um caso real.

**Entregáveis:**

- [ ] Painel web com CRUD de agentes
- [ ] Catálogo de capacidades com pelo menos 5 capacidades
- [ ] Sistema de aprovação humana
- [ ] Métricas básicas e dashboard
- [ ] RBAC funcional
- [ ] Documentação para desenvolvedores
- [ ] Caso piloto rodando em produção interna

**Critério de saída:** um agente real está em produção interna gerando valor mensurável.

---

## Fase 4 — Hardening

**Objetivo:** transformar o MVP em produto operável por outros times.

**Entregáveis:**

- [ ] Auditoria completa
- [ ] Performance e load testing
- [ ] Segurança: pentest, secrets management
- [ ] Observabilidade completa (traces, métricas, alertas)
- [ ] Disaster recovery testado
- [ ] Multi-tenancy
- [ ] Documentação para operação
- [ ] SLA formalizado

**Critério de saída:** plataforma está pronta para ser oferecida a 2-3 times além do time fundador.

---

## Fase 5 — Expansão

**Objetivo:** escala de uso e amadurecimento do ecossistema.

- Templates de agente por vertical (financeiro, atendimento, RH)
- SDK público de capacidades
- Marketplace interno de agentes/capacidades
- Modo self-service para times de negócio
- Integrações prontas com sistemas comuns

---

## Princípios de execução

1. **Cada fase precisa terminar** antes da próxima começar — sem paralelizar para ganhar tempo
2. **Cada fase termina com retrospectiva** documentada
3. **Decisões irreversíveis viram ADR** antes de serem implementadas
4. **Demo > documento** — toda entrega tem uma demo de 10min
