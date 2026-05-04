---
name: intelliforce-instances
description: Scaling declarativo de digital employees por activity. Define quantas instâncias devem existir contratadas pra rodar uma atividade — backend cria/remove diferença automaticamente. Esta skill conecta Agents (definições) a Activities (jobs).
license: MIT
allowed-tools:
  - Bash(python /opencode-runtime/.opencode/skills/intelliforce-instances/scripts/instances.py *)
  - Read
---

# Instances — scale + listagem

Após criar Agent (definição) e Activity (job), você usa esta skill pra
**contratar** os digital employees: define `target_count` e o backend
automaticamente cria/remove instâncias até bater no número.

Comportamento gracioso: ao reduzir headcount, prioriza remover `idle` →
`offline` → `error`. NÃO mata instâncias `active` (espera tarefa atual
terminar primeiro).

## Comandos

```bash
# Listar instâncias de uma activity
python .../instances.py list <activity_uuid>

# Scale — define alvo (cria ou remove diferença automaticamente)
python .../instances.py scale <activity_uuid> --target 3

# Scale especificando agent (definição) — necessário se activity não tem default
python .../instances.py scale <activity_uuid> --target 5 --agent <agent_uuid>

# "Demitir" todas
python .../instances.py scale <activity_uuid> --target 0
```

## Campos

- **target_count** — quantas instâncias devem existir (0 a 10000)
- **agent_id** — opcional. Se a activity já tem `default_agent_id`, dispensa.
  Se não tem, é obrigatório quando target > 0. O backend persiste o agent_id
  como `default_agent_id` da activity nas próximas chamadas.

## Output do scale

```json
{
  "activity_id": "uuid",
  "target_count": 3,
  "created": 2,
  "removed": 0,
  "total": 3,
  "status_breakdown": {"idle": 3}
}
```

- `created` — quantas foram criadas nesta operação
- `removed` — quantas foram removidas
- `total` — headcount atual após a operação
- `status_breakdown` — distribuição por status (idle/active/offline/error)

## Fluxo "criar digital employee novo e contratá-lo"

1. **Builder** (switch agente) cria arquivo .md em opencode/.opencode/agents/
2. Switch pro **operator**
3. `intelliforce-agents create` referenciando esse .md
4. `intelliforce-activities create` (ou pega activity existente)
5. **Aqui:** `intelliforce-instances scale <activity> --target N --agent <agent>`
6. Confirme com user que tem N instâncias `idle` rodando

## Atenção

- Scale é **idempotente**. Chamar `--target 3` duas vezes é seguro — segunda
  vez não faz nada (já está em 3).
- Reduzir pra 0 efetivamente "demite todos". Confirme com user antes.
- Não há endpoint pra "matar" instância específica — só via scale (graceful).
