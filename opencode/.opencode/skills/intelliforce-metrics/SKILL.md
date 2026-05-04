---
name: intelliforce-metrics
description: Métricas operacionais — custos por departamento, histórico de execuções, performance. Read-only.
license: MIT
allowed-tools:
  - Bash(python /opencode-runtime/.opencode/skills/intelliforce-metrics/scripts/metrics.py *)
  - Read
---

# Metrics — custos / performance

Read-only sobre métricas agregadas do IntelliForce.

## Comandos

```bash
# Métricas de um departamento (snapshot atual)
python .../metrics.py department <dept_uuid>

# Histórico de tasks por departamento
python .../metrics.py history <dept_uuid> --limit 20

# Custo agregado (cost-summary) — todos os deps, período em dias
python .../metrics.py cost --days 30

# Recent executions de uma activity específica
python .../metrics.py activity-recent <activity_uuid> --limit 10
```

## Quando usar

- "Quanto custou Finance no mês passado?" → cost --days 30 (filtra dept depois)
- "Mostra o histórico das últimas execuções no AP" → history <dept>
- "Como está a performance da activity X?" → activity-recent <activity>

## Output

JSON com estruturas como `monthly_cost_usd`, `error_pct`,
`avg_handle_seconds`, `executed_last_12h`, `timeline` (12 buckets de hora),
`failed_last_12h`, etc.
