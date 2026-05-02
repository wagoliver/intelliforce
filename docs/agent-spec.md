# Especificação dos Funcionários Virtuais

> Este documento define o que **é** um funcionário virtual no IntelliForce, suas propriedades, ciclo de vida e contratos. É a referência canônica para discussões sobre comportamento de agentes.

## Definição

Um **funcionário virtual** (ou simplesmente *agente*) é uma entidade configurada na plataforma que:

1. Tem um **papel** declarado (ex: "Analista de Cobrança", "Triador de Tickets")
2. Possui um **conjunto de capacidades** que pode invocar
3. Opera sob **políticas** definidas (limites, aprovações, horários)
4. Executa **tarefas** atribuídas, gerando saídas auditáveis
5. É **observável e mensurável** em tempo real

Não é um chatbot. Não é um script. É uma entidade com identidade, contrato e métricas — análoga a um colaborador humano, mas digital.

## Anatomia de um Agente

```yaml
# Exemplo conceitual (formato final a definir)
agent:
  id: analista-cobranca-pj
  name: "Analista de Cobrança PJ"
  role: |
    Responsável por triagem de inadimplência de clientes pessoa jurídica.
    Identifica padrão da inadimplência, propõe próxima ação e escala
    casos sensíveis para o time humano.

  owner: time-financeiro
  manager: ana.silva@arctica.com.br

  capabilities:
    - id: query.crm.cliente
      description: Consulta dados do cliente no CRM
    - id: query.financeiro.titulos-em-aberto
      description: Lista títulos vencidos e a vencer
    - id: llm.classificacao
      description: Classifica perfil de inadimplência
    - id: notify.escalonamento
      description: Notifica gestor humano quando necessário

  policies:
    schedule:
      timezone: America/Sao_Paulo
      working_hours: "08:00-18:00"
      weekdays_only: true
    spend_limit:
      daily_usd: 50
      per_task_usd: 0.50
    human_approval:
      required_for:
        - "envio.email.cliente"
        - "alteracao.status.titulo"
    escalation:
      on_error: notify_manager
      on_timeout_seconds: 300

  contract:
    inputs:
      - name: cliente_id
        type: string
        required: true
    outputs:
      - name: classificacao
        type: enum[A, B, C, D]
      - name: acao_proposta
        type: string
      - name: justificativa
        type: string
    sla:
      max_duration_seconds: 60
      target_success_rate: 0.95

  metrics:
    track:
      - tasks_executed_per_day
      - success_rate
      - avg_duration_seconds
      - human_intervention_rate
      - cost_per_task_usd
```

## Ciclo de Vida

```
┌─────────┐    ┌──────────┐    ┌──────────┐    ┌─────────┐    ┌──────────┐
│ Design  │ →  │ Sandbox  │ →  │ Homolog  │ →  │  Prod   │ →  │ Aposenta │
└─────────┘    └──────────┘    └──────────┘    └─────────┘    └──────────┘
   ↓ define        ↓ valida        ↓ aprova        ↓ opera        ↓ desliga
   - Papel         - Capacidades   - Stakeholders  - Tarefas      - Arquiva
   - Capac.        - Políticas     - Compliance    - Métricas       histórico
   - Políticas     - Custos        - Auditoria     - Melhorias    - Mantém
   - Contrato      - Casos-borda                                    auditoria
```

## Capacidades (Capabilities)

Capacidades são **funções discretas, versionadas e reutilizáveis** que o agente pode invocar. Cada capacidade declara:

- Schema de entrada (parâmetros)
- Schema de saída (resultado)
- Custo estimado (tokens, chamadas, latência)
- Permissões necessárias
- Política de retry e timeout

Tipos de capacidades:

- **`llm.*`** — Inferência em modelos de linguagem
- **`query.*`** — Leitura de dados (CRM, ERP, BD)
- **`mutation.*`** — Escrita/modificação em sistemas
- **`notify.*`** — Comunicação (e-mail, chat, ticket)
- **`compose.*`** — Invocação de outros agentes
- **`infer.*`** — Modelos especializados (classificação, OCR, etc.)

Capacidades são **públicas no catálogo** — qualquer agente pode pedir acesso a elas, sujeito a aprovação.

## Políticas

### Limites operacionais

- Horário de operação (timezone, janelas, exceções)
- Limite de gasto (diário, por tarefa, por capacidade)
- Limite de paralelismo (quantas tarefas simultâneas)

### Governança

- Pontos de aprovação humana obrigatória
- Capacidades que exigem MFA do operador
- Dados sensíveis que não podem deixar o ambiente
- Períodos de freeze (ex: durante release crítico)

### Comportamento em falha

- Retry (quantidade, backoff)
- Escalonamento (notificar quem, quando)
- Fallback (capacidade alternativa)
- Circuit breaker (parar agente após N falhas)

## Contrato

Todo agente expõe um **contrato** explícito, análogo a uma descrição de cargo:

- **O que recebe** — entradas obrigatórias e opcionais
- **O que entrega** — saídas garantidas
- **Em quanto tempo** — SLA de duração
- **Com que confiabilidade** — taxa de sucesso esperada
- **A que custo** — estimativa de custo por tarefa

Mudanças no contrato são **versionadas** (semver). Quebras de contrato exigem aprovação dos consumidores.

## Métricas Mínimas

Todo agente, sem configuração extra, expõe:

| Métrica | Descrição |
|---------|-----------|
| `tasks_total` | Tarefas atribuídas |
| `tasks_succeeded` | Tarefas concluídas com sucesso |
| `tasks_failed` | Tarefas que falharam |
| `tasks_escalated` | Tarefas escaladas para humano |
| `duration_seconds` | Histograma de duração |
| `cost_usd` | Custo total (LLMs + APIs) |
| `human_interventions` | Intervenções humanas necessárias |

## Auditoria

Para cada tarefa executada, o sistema persiste:

- Entrada completa
- Cada capacidade invocada (com parâmetros e resultado)
- Cada decisão tomada pelo agente (com raciocínio quando aplicável)
- Aprovações humanas (quem, quando, por quê)
- Saída final
- Custo realizado

Esses registros são **imutáveis** e retidos conforme política da organização.
