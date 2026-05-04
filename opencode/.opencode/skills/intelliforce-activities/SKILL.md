---
name: intelliforce-activities
description: CRUD de atividades (jobs operacionais executados por digital employees). Cada activity vive dentro de um squad e pode ter agendamento cron. Endpoints aninhados em /departments/{dept}/squads/{squad}/activities.
license: MIT
allowed-tools:
  - Bash(python /opencode-runtime/.opencode/skills/intelliforce-activities/scripts/activities.py *)
  - Read
---

# Activities — CRUD + agendamento cron

Activity é a unidade de trabalho que digital employees executam. Vive dentro
de um squad, tem opcional schedule cron e um número alvo de instâncias.

## Comandos

```bash
# Criar (sem agendamento — execução sob demanda via /tasks)
python .../activities.py create \
    --dept <dept_uuid> --squad <squad_uuid> \
    --name validar-notas --display-name "Validar Notas" \
    --skill-code VAL --target-count 3

# Criar com agendamento cron
python .../activities.py create \
    --dept <dept_uuid> --squad <squad_uuid> \
    --name validar-notas --display-name "Validar Notas" \
    --skill-code VAL --target-count 3 \
    --schedule "*/15 * * * *"

# Atualizar (qualquer subset)
python .../activities.py update <dept_uuid> <squad_uuid> <activity_uuid> \
    --schedule "0 9 * * MON-FRI" --target-count 5

# Atribuir digital employee default (skill intelliforce-instances faz scale)
python .../activities.py update <dept_uuid> <squad_uuid> <activity_uuid> \
    --default-agent <agent_uuid>

# Deletar
python .../activities.py delete <dept_uuid> <squad_uuid> <activity_uuid>
```

## Campos

- **name** — slug único dentro do squad, kebab-case até 64 chars
- **display_name** — nome amigável até 255 chars
- **skill_code** — código curto até 8 chars (ex: VAL, MAT, KYC). Convenção visual.
- **target_agent_count** — quantas instâncias deveriam estar contratadas (default 1, max 10000)
- **schedule** — cron expression (5 ou 6 campos). Backend valida via croniter.
- **default_agent_id** — UUID do agent (digital employee) que executa essa activity quando dispara. Pode ser definido depois.

## Cron — exemplos práticos

| Expressão | Significado |
|---|---|
| `*/15 * * * *` | A cada 15 minutos |
| `0 9 * * MON-FRI` | 09:00 segunda a sexta |
| `0 */4 * * *` | A cada 4 horas |
| `0 0 1 * *` | Dia 1 de cada mês, meia-noite |

Sem `--schedule`, activity executa sob demanda (via skill `intelliforce-tasks`).

## Fluxo recomendado

1. `intelliforce-discover` pra confirmar que dept + squad existem
2. Confirmar com user os campos (especialmente schedule — pedir descrição em
   linguagem natural, traduzir pra cron, mostrar interpretação reversa)
3. Após criar, ainda falta atribuir digital employee + scale (skills
   `intelliforce-agents` + `intelliforce-instances`). Mencione isso ao user.

## Atenção

- Schedule cron muda quando next_run vai disparar. Validar com user qual
  fuso horário ele está pensando — backend assume UTC.
- target_agent_count é **declarativo** (estado desejado). Pra realmente
  contratar, use a skill `intelliforce-instances` (POST /activities/{id}/scale).
