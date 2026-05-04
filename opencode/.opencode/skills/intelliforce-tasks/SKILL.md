---
name: intelliforce-tasks
description: Disparar tarefas (tasks) pra digital employees executarem, listar status e cancelar em andamento. Task é a unidade atômica de trabalho — cada uma vira uma invocação do OpenCode CLI no worker.
license: MIT
allowed-tools:
  - Bash(python /opencode-runtime/.opencode/skills/intelliforce-tasks/scripts/tasks.py *)
  - Read
---

# Tasks — disparar / listar / cancelar

Task = unidade de trabalho. Cada task tem um agent_id (definição) e um input
(JSON arbitrário) ou prompt (texto). Backend enfileira, worker consome,
OpenCode executa.

## Comandos

```bash
# Listar (filtros opcionais)
python .../tasks.py list                              # mais recentes (50)
python .../tasks.py list --status running             # filtra por status
python .../tasks.py list --agent <agent_uuid>         # filtra por agent
python .../tasks.py list --limit 10

# Pegar uma específica
python .../tasks.py get <task_uuid>

# Disparar (input em JSON ou prompt em texto)
python .../tasks.py create --agent <agent_uuid> \
    --prompt "Valida o CNPJ 11.222.333/0001-44"
python .../tasks.py create --agent <agent_uuid> \
    --input '{"cnpj": "11.222.333/0001-44"}'

# Cancelar
python .../tasks.py cancel <task_uuid> --reason "user pediu pra parar"
```

## Status possíveis

`pending` (na fila) · `running` (executando) · `awaiting_approval`
(aguardando humano) · `completed` (terminou OK) · `failed` (erro) ·
`cancelled` (cancelada)

## Output do create

Retorna a Task criada com id, status inicial (pending), correlation_id, etc.
Mencione ao user o `id` pra ele acompanhar.
