---
name: intelliforce-teams
description: "Microsoft Teams via 2 caminhos coexistindo: Power Automate webhook (one-way, default) e Graph API (bidirecional, suporta listen e mention real). Webhook pra notificações cotidianas; Graph pra fluxos avançados onde precisa receber resposta ou mencionar pessoas."
license: MIT
allowed-tools:
  - Bash(python /opencode-runtime/.opencode/skills/intelliforce-teams/scripts/teams.py *)
  - Read
---

# IntelliForce Teams — webhook + Graph coexistindo

Skill que posta/lê em Microsoft Teams por **dois caminhos diferentes**,
escolhidos por flag `--via webhook|graph`. Cada um tem seu trade-off:

| | **Webhook** (default) | **Graph API** |
|---|---|---|
| Setup | 1 flow no Power Automate por channel | Azure AD App + RSC + manifest + install no team |
| Auth | SAS token na URL | OAuth client_credentials |
| Vault | `teams-webhook-<channel>` (campo `url`) | `microsoft-teams` (3 campos) |
| `send` | ✅ | ✅ (com mention real opcional) |
| `send-card` | ✅ | ✅ (como attachment) |
| `listen` | ❌ | ✅ |
| `list-teams` / `list-channels` / `resolve` | ❌ | ✅ |
| Mention notificável | ❌ | ✅ (`--mention <upn>`) |
| Bloqueia em policy de tenant restritiva | ❌ | ⚠️ (precisa custom apps liberados) |

**Regra de bolso**: pra qualquer notificação one-way, use **webhook**
(simples, sem dependência). Pra fluxos onde o agente precisa esperar
resposta de humano ou mencionar pessoa específica com toque no celular,
use **Graph**.

## Pré-requisitos

### Webhook (mínimo pra começar)

1. Criar flow no Power Automate (1 por channel-alvo):
   - Trigger: **When a HTTP request is received** (body schema vazio)
   - Step: **Microsoft Teams → Post card in a chat or channel**
     - Post in: Channel
     - Adaptive Card: expressão `triggerBody()`
   - Save → copia URL do trigger
2. Cadastrar no `/vault`:
   - Slug: `teams-webhook-<channel-em-kebab>` (ex.: `teams-webhook-digital-employee`)
   - Campo único: `url` = URL do trigger

### Graph (opcional, pra listen/mention)

1. Azure AD App Registration → API Permissions (Application):
   - `Team.ReadBasic.All`, `Channel.ReadBasic.All`, `ChannelMessage.Read.All`,
     `User.Read.All`
   - Grant admin consent
2. Cadastrar no `/vault`:
   - Slug: `microsoft-teams`
   - 3 campos: `client_id`, `client_secret`, `tenant_id`
3. Pra `send` em channel via Graph: gerar Teams App package em
   `tools/teams-app-package/`, upload no Teams Admin Center, install
   no team-alvo (ver `tools/teams-app-package/README.md`).

> Em tenants com policy "Allow custom apps = OFF", o caminho Graph fica
> inviável até liberar via Teams Admin Center → Permission policies.

## Comandos

### `send` — texto simples

```bash
# Webhook (default — recomendado pra notificações)
python .../teams.py send --message "Texto" [--subject "Título"]
python .../teams.py send --message "X" --webhook-secret teams-webhook-outro-channel

# Graph (pra mention notificável ou postar como user/bot do Azure)
python .../teams.py send --via graph \
    --team "xOne - Notificações Sistêmicas" \
    --channel "Digital Employee" \
    --message "Aprovar?" --mention chefe@arctica.com.br
```

`--mention` só funciona com `--via graph`. Resolve UPN → user object via
`/users/{upn}` e injeta `<at>` no início da mensagem.

### `send-card` — Adaptive Card customizado

```bash
# Webhook
python .../teams.py send-card --card-file /tmp/card.json
cat card.json | python .../teams.py send-card

# Graph (encapsula como attachment)
python .../teams.py send-card --via graph --team T --channel C --card-file card.json
```

⚠️ Raiz do JSON precisa ter `"type": "AdaptiveCard"` direto. Wrapper
`{contentType, content}` é desempacotado automaticamente, mas evite.

### `listen` — espera resposta (graph only)

```bash
python .../teams.py listen \
    --team "xOne - Notificações Sistêmicas" \
    --channel "Digital Employee" \
    [--since <iso8601>] [--timeout 300] [--poll-interval 15] [--exclude-self]
```

Polla `/teams/{id}/channels/{id}/messages` até a 1ª mensagem nova
aparecer. `--exclude-self` ignora mensagens enviadas pelo próprio app
(evita auto-loop em fluxos manda+escuta). Exit 3 + stderr `TIMEOUT` se
nada chegar até `--timeout`.

### `list-teams`, `list-channels`, `resolve` — discovery (graph only)

```bash
python .../teams.py list-teams                                    # array de teams
python .../teams.py list-channels --team "xOne - Notificações Sistêmicas"
python .../teams.py resolve --team "xOne ..." --channel "Digital Employee"
```

Útil pra descobrir UUIDs antes de configurar workflows.

## Erros (stderr categóricos)

### Comuns aos dois modos

| Stderr | Causa |
|---|---|
| `VAULT_MISSING` | Secret do webhook ou Graph não cadastrado |
| `VAULT_FIELD_MISSING` | Secret existe sem campo necessário |
| `VAULT_MISSING_FIELDS` | Secret Graph sem `client_id`/`client_secret`/`tenant_id` |
| `NETWORK_ERROR` | Sem internet ou serviço offline |

### Webhook

| Stderr | Causa |
|---|---|
| `WEBHOOK_UNAUTHORIZED (401/403)` | URL/SAS expirada — re-gere no Power Automate |
| `WEBHOOK_NOT_FOUND (404)` | Flow deletado |
| `WEBHOOK_BAD_REQUEST (400)` | Card inválido |

### Graph

| Stderr | Causa |
|---|---|
| `AUTH_ERROR_400/401` | Credentials inválidas, secret expirado |
| `PERMISSION_DENIED (Authorization_RequestDenied)` | Falta admin consent ou RSC no team |
| `TEAM_NOT_FOUND` / `CHANNEL_NOT_FOUND` | Nome não bate; lista as opções disponíveis |
| `NOT_FOUND` | Recurso inexistente ou app sem acesso |
| `TOKEN_REJECTED` | access_token rejeitado pelo Graph |
| `TIMEOUT` (listen) | Nenhuma mensagem nova até `--timeout` |

### Card / Input

| Stderr | Causa |
|---|---|
| `CARD_INVALID_JSON` | JSON malformado |
| `CARD_INVALID_SHAPE` | Raiz sem `type: "AdaptiveCard"` |
| `CARD_INPUT_MISSING` | Sem `--card-file`, `--card-json` ou stdin |
| `MENTION_NOT_SUPPORTED_VIA_WEBHOOK` | `--mention` precisa `--via graph` |
| `GRAPH_REQUIRES_TEAM_AND_CHANNEL` | `--via graph` exige `--team` + `--channel` |

Exit codes: 0 sucesso · 1 runtime · 2 erro de uso · 3 timeout

## Padrão de uso em outras skills

### Notificação simples (escolha quase sempre webhook)

```python
import json, subprocess, sys

TEAMS = "/opencode-runtime/.opencode/skills/intelliforce-teams/scripts/teams.py"

def notificar(message: str, skill_slug: str, *, subject: str | None = None) -> dict:
    cmd = ["python", TEAMS, "send", "--message", message, "--skill", skill_slug]
    if subject:
        cmd.extend(["--subject", subject])
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if r.returncode != 0:
        print(r.stderr.strip(), file=sys.stderr); sys.exit(1)
    return json.loads(r.stdout)
```

### Aprovação async (manda + espera resposta — exige Graph)

```python
def perguntar_e_esperar(
    pergunta: str, mention_upn: str, skill_slug: str,
    *, team: str = "xOne - Notificações Sistêmicas",
    channel: str = "Digital Employee",
    timeout: int = 600,
) -> dict | None:
    # 1. Manda via Graph com mention pra notificar a pessoa
    subprocess.run([
        "python", TEAMS, "send", "--via", "graph",
        "--team", team, "--channel", channel,
        "--message", pergunta, "--mention", mention_upn,
        "--skill", skill_slug,
    ], check=True, timeout=30)

    # 2. Espera resposta no mesmo channel
    r = subprocess.run([
        "python", TEAMS, "listen",
        "--team", team, "--channel", channel,
        "--timeout", str(timeout), "--exclude-self",
        "--skill", skill_slug,
    ], capture_output=True, text=True, timeout=timeout + 30)
    if r.returncode == 3:
        return None  # timeout
    if r.returncode != 0:
        print(r.stderr.strip(), file=sys.stderr); sys.exit(1)
    msgs = json.loads(r.stdout)
    return msgs[0] if msgs else None
```

## Channels já configurados

| Team | Channel | Webhook secret |
|---|---|---|
| xOne - Notificações Sistêmicas | Digital Employee | `teams-webhook-digital-employee` |

Outros: criar 1 flow + 1 secret (slug `teams-webhook-<nome-em-kebab>`).
