---
name: intelliforce-audit
description: Auditoria — eventos persistidos no event bus, chamadas LLM (custos/latência) e timeline de uma task específica. Read-only por design — auditoria não pode ser editada.
license: MIT
allowed-tools:
  - Bash(python /opencode-runtime/.opencode/skills/intelliforce-audit/scripts/audit.py *)
  - Read
---

# Audit — eventos / llm-calls / timeline

Toda transição/ação no sistema vira evento persistido (event sourcing). Esta
skill expõe consultas read-only sobre esse acervo.

## Comandos

```bash
# Lista eventos genéricos (com filtros)
python .../audit.py events --limit 50
python .../audit.py events --aggregate-type task --aggregate-id <uuid>
python .../audit.py events --type task.completed

# LLM calls (chamadas ao modelo via OpenCode)
python .../audit.py llm-calls --limit 100
python .../audit.py llm-calls --task-id <uuid>

# Timeline detalhada de uma task específica (eventos + steps)
python .../audit.py timeline <task_uuid>
```

## Filtros (events)

- `--type` — filtra por tipo de evento (ex: `task.created`, `human.approval_granted`)
- `--aggregate-type` — `task`, `agent`, `approval`, `activity`, etc
- `--aggregate-id` — UUID do recurso
- `--limit` — default 50

## Quando usar

- "O que aconteceu com a task X?" → timeline
- "Quanto custou a task Y?" → llm-calls --task-id
- "Quem aprovou Z?" → events --aggregate-id <approval>
- Debug de operações que falharam — timeline + llm-calls juntos
