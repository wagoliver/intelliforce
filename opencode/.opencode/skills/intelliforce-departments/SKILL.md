---
name: intelliforce-departments
description: CRUD de departamentos do IntelliForce. Departamento é a unidade organizacional top-level — agrupa squads e atividades. Sempre rode intelliforce-discover antes de criar pra evitar duplicatas.
license: MIT
allowed-tools:
  - Bash(python /opencode-runtime/.opencode/skills/intelliforce-departments/scripts/departments.py *)
  - Read
---

# Departments — CRUD

Operações sobre departamentos via API IntelliForce.

## Comandos

```bash
# Listar todos
python .../departments.py list

# Pegar um por id
python .../departments.py get <uuid>

# Criar
python .../departments.py create --name finance --display-name "Finance" \
    --objective "Processar 100% das notas em até 5min"

# Atualizar (qualquer subset dos campos)
python .../departments.py update <uuid> --display-name "Finanças BR" \
    --objective "Novo objetivo"

# Deletar (cascata: squads + activities + instances do dept inteiro)
python .../departments.py delete <uuid>
```

## Campos

- **name** (obrigatório) — slug kebab-case único, até 64 chars (regex `^[a-z0-9]+(-[a-z0-9]+)*$`)
- **display_name** (obrigatório) — nome amigável, até 255 chars
- **objective** — texto descritivo do propósito, até 4000 chars
- **monthly_cost_budget_usd** — orçamento mensal opcional (decimal)
- **health** — `healthy` (default) ou `attention`

## Fluxo recomendado

1. Sempre rode `intelliforce-discover --only departments` antes de criar
2. Confirme com user os campos antes de POST
3. Após criar, retorne o ID novo (user pode precisar pra adicionar squads em seguida)
4. **DELETE é destrutivo em cascata** — sempre confirme com user; mostre quantos squads/activities/instances vão junto
