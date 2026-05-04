---
name: intelliforce-squads
description: CRUD de squads (subdivisões dentro de departamentos). Squad agrupa atividades relacionadas. Endpoints aninhados em /departments/{dept_id}/squads.
license: MIT
allowed-tools:
  - Bash(python /opencode-runtime/.opencode/skills/intelliforce-squads/scripts/squads.py *)
  - Read
---

# Squads — CRUD

Squads são subdivisões dentro de departamentos. Cada squad agrupa atividades.

## Comandos

```bash
# Criar
python .../squads.py create --dept <dept_uuid> --name ap --display-name "Accounts Payable"

# Atualizar
python .../squads.py update <dept_uuid> <squad_uuid> --display-name "AP — Brasil"

# Deletar (cascata: activities + instances do squad)
python .../squads.py delete <dept_uuid> <squad_uuid>
```

## Campos

- **name** — slug kebab-case até 64 chars
- **display_name** — nome amigável até 255 chars
- **position** — ordem visual (int, default 0)

## Fluxo

1. Listar departamentos primeiro (`intelliforce-discover` ou departments list)
2. Squad sempre pertence a um departamento — exigir `--dept` no create
3. Squads vivem dentro do payload do `GET /departments/{id}` (não há endpoint
   separado pra listar squads — leia via discover)
