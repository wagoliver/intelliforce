---
name: intelliforce-discover
description: Lista o estado atual do IntelliForce — departamentos, squads, atividades, agentes (digital employees) e tarefas recentes. Use SEMPRE antes de criar algo novo pra evitar duplicatas e dar contexto pro usuário.
license: MIT
allowed-tools:
  - Bash(python /opencode-runtime/.opencode/skills/intelliforce-discover/scripts/discover.py *)
  - Read
---

# Discover — visão consolidada do sistema

Lê o estado atual do IntelliForce em UMA chamada (paralelizando as requests
internamente). Use esta skill como **primeiro passo** de qualquer fluxo de
criação ou modificação — evita duplicatas, dá IDs pro user referenciar e
contextualiza decisões.

## Quando usar

- User pergunta "o que existe no sistema?" / "lista os departamentos" / "quais
  digital employees temos?"
- Antes de criar departamento/squad/activity/agent (pra ver se já existe)
- Antes de scale/edit/delete (pra confirmar IDs)
- Quando user é vago ("crie uma atividade no departamento principal") — discover
  primeiro pra perguntar "qual destes?" se houver mais de um candidato

## Como rodar

```bash
python /opencode-runtime/.opencode/skills/intelliforce-discover/scripts/discover.py
```

Sem argumentos pra listagem completa. Filtros opcionais:

```bash
# Só departamentos
python .../discover.py --only departments

# Só recent tasks (últimas 10 por default, ajustável)
python .../discover.py --only tasks --limit 20

# Múltiplas áreas
python .../discover.py --only departments,agents
```

Áreas válidas: `departments`, `agents`, `tasks`. Sem `--only`, lista todas.

## Output

JSON com estrutura:

```json
{
  "departments": [
    {
      "id": "uuid",
      "name": "finance",
      "display_name": "Finance",
      "objective": "...",
      "health": "healthy",
      "total_agents": 24,
      "squads": [
        {
          "id": "uuid",
          "name": "ap",
          "display_name": "Accounts Payable",
          "activities": [
            {"id": "uuid", "name": "...", "skill_code": "...", "schedule": "*/15 * * * *", "agent_count": 3, ...}
          ]
        }
      ]
    }
  ],
  "agents": [
    {"id": "uuid", "name": "validador", "display_name": "Validador de Notas", "skills": ["..."], "is_active": true, ...}
  ],
  "recent_tasks": [
    {"id": "uuid", "agent_id": "uuid", "status": "completed", "started_at": "...", "duration_ms": 1234, ...}
  ],
  "summary": {
    "departments_count": 4,
    "squads_count": 9,
    "activities_count": 22,
    "agents_count": 7,
    "recent_tasks_count": 10
  }
}
```

## Como apresentar ao user

NÃO despeje JSON cru. Renderize em markdown amigável:

✅ Bom:
```
# Estado atual

**4 departamentos**, **7 digital employees**, **22 atividades** ativas.

## Finance (24 agentes · saudável)
- Accounts Payable (3 atividades)
  - Validar Notas · a cada 15min · 3 instâncias
  - PO Matching · sob demanda · 2 instâncias
  ...
```

❌ Ruim: copiar e colar o JSON inteiro.

## Tratamento de erros

Mesma convenção da `intelliforce-api`:
- `TOKEN_EMPTY`/`TOKEN_EXPIRED_OR_INVALID` → user precisa logar de novo
- `API_ERROR_<code>` → mostrar detail do backend
- `NETWORK_ERROR` → API down / rede instável
