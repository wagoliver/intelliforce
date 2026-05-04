---
name: intelliforce-api
description: Skill fundação do operador IntelliForce. Define como chamar a API do sistema, autenticação JWT, base URL via docker network interna, padrões de resposta, tratamento de erros e como ler secrets do Cofre. Outras skills intelliforce-* seguem o mesmo padrão.
license: MIT
allowed-tools:
  - Bash(python /opencode-runtime/.opencode/skills/intelliforce-api/scripts/auth_check.py *)
  - Bash(python /opencode-runtime/.opencode/skills/intelliforce-api/scripts/list_secrets.py *)
  - Bash(python /opencode-runtime/.opencode/skills/intelliforce-api/scripts/get_secret.py *)
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

## Cofre / Vault — secrets criptografados

O IntelliForce tem um Cofre (`/vault` na UI) onde o user cadastra senhas e
tokens (Zoho, ITSM, banco, qualquer credencial externa). Skills NUNCA
guardam credenciais no código — sempre buscam pelo slug em runtime.

### Listar secrets disponíveis

```bash
python /opencode-runtime/.opencode/skills/intelliforce-api/scripts/list_secrets.py
```

Retorna metadados (slug, description, tags, criado em, último acesso) — **nunca
o valor**. Use quando o user perguntar "quais credenciais o sistema tem?" ou
quando precisar descobrir qual slug usar.

### Ler valor de um secret

```bash
python /opencode-runtime/.opencode/skills/intelliforce-api/scripts/get_secret.py <slug> --skill <nome-da-skill> [--task-id <uuid>]
```

Saída: o valor descriptografado direto em **stdout** (1 linha, sem newline
extra). Stderr só pra erros.

**Padrão de uso em outras skills `intelliforce-*` que precisam de credencial
externa**, ex.: skill `intelliforce-zoho-validador` chamando API Zoho:

```python
import os, subprocess, sys, httpx

# Pega token Zoho do Cofre — uma chamada por execução, não cachear em arquivo
result = subprocess.run(
    [
        "python",
        "/opencode-runtime/.opencode/skills/intelliforce-api/scripts/get_secret.py",
        "zoho-api-token",
        "--skill", "intelliforce-zoho-validador",  # ← slug DESTA skill, não da intelliforce-api
    ],
    capture_output=True,
    text=True,
    timeout=20,
)
if result.returncode != 0:
    print(result.stderr.strip(), file=sys.stderr)
    sys.exit(1)

zoho_token = result.stdout  # já vem sem newline extra

# Usa o token pra chamar Zoho
resp = httpx.get(
    "https://api.zoho.com/some/endpoint",
    headers={"Authorization": f"Zoho-oauthtoken {zoho_token}"},
    timeout=15,
)
# ... resto do fluxo
```

### Regras pra usar o Vault corretamente

1. **Sempre passe `--skill <slug-da-skill>`** com o nome real desta skill,
   não da intelliforce-api. O audit log usa pra rastrear quem acessou o quê.
2. **Nunca persista o valor**: não escreva em arquivo, log, ou variável que
   sobreviva à execução. Use direto na chamada externa e descarte.
3. **Não imprima o valor em stdout** quando for retornar resposta pro user.
   Se o user perguntar "qual o valor do token?", responda que pode revelar
   apenas pela UI `/vault` (que tem timer de auto-hide e audit reforçado).
4. **Se o secret não existe** (`SECRET_NOT_FOUND`), avise o user pra cadastrar
   na tela `/vault` — não invente um valor mockado.
5. **Imutabilidade**: pra trocar valor, user tem que deletar e criar de novo.
   Não há endpoint de update.
