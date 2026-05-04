---
name: intelliforce-api
description: Skill fundação do operador IntelliForce. Define como chamar a API do sistema, autenticação JWT, base URL via docker network interna, padrões de resposta e tratamento de erros. Outras skills intelliforce-* seguem o mesmo padrão.
license: MIT
allowed-tools:
  - Bash(python /opencode-runtime/.opencode/skills/intelliforce-api/scripts/auth_check.py *)
  - Read
---

# IntelliForce API — fundação

Skill base que documenta como o operator chama a API do IntelliForce em nome do
usuário logado. Toda outra skill `intelliforce-*` herda os padrões definidos
aqui — leia esta skill primeiro antes de tentar entender as outras.

## Autenticação

O backend injeta credenciais como variáveis de ambiente quando o agente
operator é spawned via /chat/stream:

| Variável | Significado |
|---|---|
| `INTELLIFORCE_TOKEN` | JWT Bearer do usuário logado. Pass-through do header `Authorization`. Expira em ~1h. |
| `INTELLIFORCE_API_URL` | Base URL da API. Em docker-compose: `http://api:8000`. Em dev local fora do docker: `http://localhost:8000`. |
| `INTELLIFORCE_USER_ID` | UUID do usuário (informacional, não precisa enviar). |
| `INTELLIFORCE_USER_EMAIL` | Email do user logado (informacional). |

**Não persistir o JWT em arquivo.** Vive só na memória do processo.

## Padrão de chamada HTTP

Todos os scripts das skills `intelliforce-*` seguem este shape:

```python
import os, sys, json, httpx

TOKEN = os.environ.get("INTELLIFORCE_TOKEN", "")
BASE_URL = os.environ.get("INTELLIFORCE_API_URL", "http://localhost:8000")
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

if not TOKEN:
    print("TOKEN_EMPTY", file=sys.stderr)
    sys.exit(1)

resp = httpx.get(f"{BASE_URL}/some/path", headers=HEADERS, timeout=15)
if resp.status_code == 401:
    print("TOKEN_EXPIRED_OR_INVALID", file=sys.stderr)
    sys.exit(1)
resp.raise_for_status()
print(json.dumps(resp.json(), indent=2, ensure_ascii=False))
```

## Convenções de output

Scripts retornam:
- **stdout** — JSON pretty-printed da resposta (operator parseia/formata pro user)
- **stderr** — apenas mensagens de erro (categóricas: `TOKEN_EMPTY`, `TOKEN_EXPIRED_OR_INVALID`, `API_ERROR_<code>`, `NETWORK_ERROR`)
- **exit code** — 0 sucesso, 1 erro recuperável (auth/network), 2 erro de uso (params inválidos)

## Tratamento de erros

Operator deve interpretar stderr/exit code:

| Stderr | Ação |
|---|---|
| `TOKEN_EMPTY` ou `TOKEN_EXPIRED_OR_INVALID` | Avisar user pra fazer login de novo. |
| `API_ERROR_404` | Recurso não existe — confirmar IDs com user. |
| `API_ERROR_4xx` | Validation/business rule failure — mostrar detail pro user. |
| `API_ERROR_5xx` | Sistema com problema — sugerir retry ou ver logs. |
| `NETWORK_ERROR` | API down ou rede instável. Sugerir verificar health do worker. |

## Endpoints disponíveis (resumo)

A API IntelliForce tem 39 endpoints. Cada categoria tem sua própria skill:

- `intelliforce-discover` — listagens read-only de tudo (pra contextualizar)
- `intelliforce-departments` — CRUD departamentos
- `intelliforce-squads` — CRUD squads (aninhado em dept)
- `intelliforce-activities` — CRUD atividades + agendamento cron
- `intelliforce-agents` — CRUD digital employees (definição)
- `intelliforce-instances` — scale (contratar/demitir instâncias por activity)
- `intelliforce-tasks` — disparar e listar tasks
- `intelliforce-approvals` — inbox + approve/reject
- `intelliforce-audit` — eventos, llm-calls, timeline
- `intelliforce-metrics` — métricas por department, custos, history

## Sanity check — auth_check.py

Script auxiliar pra confirmar que a auth está funcionando antes de qualquer
operação real. Útil pra debugar problemas de credenciais.

```bash
python /opencode-runtime/.opencode/skills/intelliforce-api/scripts/auth_check.py
```

Retorna o JSON de `GET /auth/me` (id, email, name, role do user logado).

Use no início de qualquer fluxo onde você suspeita que o token expirou ou
quando o user pergunta "quem sou eu?".
