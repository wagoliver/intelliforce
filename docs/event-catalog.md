# Catálogo de Eventos — IntelliForce

> Referência canônica de todos os eventos do sistema. Toda mudança de estado relevante vira um evento aqui. Atualize sempre que adicionar evento novo.

## Convenções

- **Nome:** `{aggregate}.{action}` em snake_case (ex: `task.created`, `agent.skill_invoked`)
- **Persistência:** todos os eventos vão na tabela `events` do Postgres (append-only)
- **Publicação:** outbox publisher lê eventos não publicados e envia pro Redis Streams
- **Stream:** um stream por `aggregate_type` (ex: `events.task`, `events.agent`)
- **Identificador:** ULID (ordenável por tempo)

## Schema do evento

```json
{
  "id": "01HX...",
  "type": "task.created",
  "aggregate_id": "task_xyz",
  "aggregate_type": "task",
  "payload": { ... },
  "metadata": {
    "actor": "user_123",
    "correlation_id": "trace_abc",
    "causation_id": "evt_anterior"
  },
  "occurred_at": "2026-05-02T20:30:00Z"
}
```

---

## Categorias

### `task.*` — Ciclo de vida de tarefa

| Evento | Quando emitir | Payload |
|--------|---------------|---------|
| `task.created` | API/scheduler/agente cria tarefa | `agent_id`, `input`, `triggered_by` |
| `task.assigned` | Worker pega tarefa pra executar | `worker_id` |
| `task.started` | Worker começa execução | `started_at` |
| `task.cli_invoked` | Worker invocou OpenCode CLI | `command`, `agent`, `timeout` |
| `task.cli_completed` | OpenCode terminou (sucesso ou erro) | `exit_code`, `duration_ms`, `tokens_*`, `cost_usd` |
| `task.step_completed` | Passo intermediário do agente terminou | `step_name`, `result_summary` |
| `task.awaiting_approval` | Tarefa pausada esperando humano | `approval_id`, `reason` |
| `task.approved` | Aprovação concedida | `approval_id`, `approver_user_id` |
| `task.rejected` | Aprovação negada | `approval_id`, `reason` |
| `task.completed` | Tarefa terminou com sucesso | `result_summary`, `duration_ms`, `cost_usd` |
| `task.failed` | Tarefa falhou irrecuperavelmente | `error_message`, `error_type` |
| `task.cancelled` | Usuário cancelou | `cancelled_by_user_id`, `reason` |
| `task.escalated` | Escalou pra outro agente/humano | `target`, `reason` |

### `agent.*` — Granularidade fina de execução

| Evento | Quando emitir | Payload |
|--------|---------------|---------|
| `agent.skill_invoked` | Agente invocou skill | `skill_name`, `arguments`, `task_id` |
| `agent.skill_completed` | Skill terminou | `skill_name`, `result`, `duration_ms`, `success` |
| `agent.llm_called` | Chamada LLM emitida | `model`, `provider`, `task_id` |
| `agent.llm_responded` | LLM respondeu | `tokens_input`, `tokens_output`, `tokens_reasoning`, `latency_ms`, `cost_usd` |
| `agent.tool_called` | Tool externa invocada | `tool_name`, `arguments` |
| `agent.decision_made` | Decisão importante do agente (com reasoning) | `decision`, `reasoning`, `evidence` |

### `agent.management.*` — Gestão do agente (configuração)

| Evento | Quando emitir | Payload |
|--------|---------------|---------|
| `agent.created` | CRUD: agente novo cadastrado | `agent_id`, `name`, `created_by_user_id` |
| `agent.updated` | CRUD: configuração alterada | `agent_id`, `changed_fields` |
| `agent.activated` | Agente foi ativado | `agent_id` |
| `agent.deactivated` | Agente desativado | `agent_id`, `reason` |
| `agent.schedule_changed` | Schedule (cron) alterado | `agent_id`, `old_schedule`, `new_schedule` |

### `human.*` — Interação humana

| Evento | Quando emitir | Payload |
|--------|---------------|---------|
| `human.approval_requested` | Pedido de aprovação criado | `approval_id`, `task_id`, `requested_to_user_id` |
| `human.approval_granted` | Humano aprovou | `approval_id`, `approver_user_id`, `decision_reason` |
| `human.approval_denied` | Humano negou | `approval_id`, `approver_user_id`, `decision_reason` |
| `human.intervention_applied` | Override manual em tarefa | `task_id`, `user_id`, `action` |

### `user.*` — Eventos de usuário (auth, sessão)

| Evento | Quando emitir | Payload |
|--------|---------------|---------|
| `user.registered` | Conta criada | `user_id`, `email`, `role` |
| `user.logged_in` | Login bem-sucedido | `user_id`, `ip` |
| `user.logged_out` | Logout | `user_id` |
| `user.role_changed` | Mudança de papel | `user_id`, `old_role`, `new_role` |

### `system.*` — Eventos da plataforma

| Evento | Quando emitir | Payload |
|--------|---------------|---------|
| `system.worker_started` | Worker subiu | `worker_id`, `version` |
| `system.worker_stopped` | Worker parando | `worker_id`, `reason` |
| `system.error` | Erro não-recuperável | `component`, `error_message`, `stack_trace` |

---

## Streams Redis

O outbox publisher publica eventos em streams nomeados por `aggregate_type`:

| Stream | Eventos publicados |
|--------|-------------------|
| `events.task` | Todos os `task.*` |
| `events.agent` | Todos os `agent.*` (incluindo management) |
| `events.human` | Todos os `human.*` |
| `events.user` | Todos os `user.*` |
| `events.system` | Todos os `system.*` |

Consumers interessados em vários streams criam **um consumer group por papel** (ex: `audit-projector`, `webhook-notifier`, `worker-executor`).

---

## Padrão de payload

- **Sempre JSON serializável** (sem objetos Python custom)
- **Datas em ISO 8601 UTC**
- **IDs como string** (UUID/ULID — não inteiros)
- **Não incluir dados sensíveis** sem necessidade (LGPD)

## Versionamento

Quando precisar mudar schema de um evento:

1. Adicionar campo opcional → não quebra
2. Renomear campo → bump de versão (novo `type`: `task.created.v2`)
3. Remover campo → idem (versão nova)

Eventos antigos continuam no histórico — projetors devem saber lidar com versões.

---

## Como emitir um evento (do código)

```python
from intelliforce.events.bus import EventBus

async with async_session_factory() as session:
    bus = EventBus(session)
    await bus.emit(
        type="task.created",
        aggregate_id=str(task.id),
        aggregate_type="task",
        payload={"agent_id": str(task.agent_id), "input": task.input},
        metadata={"actor": "api", "correlation_id": task.correlation_id},
    )
    await session.commit()  # outbox + state mudam atomicamente
```
