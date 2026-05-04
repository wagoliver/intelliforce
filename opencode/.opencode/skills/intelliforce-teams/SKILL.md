---
name: intelliforce-teams
description: "Envia e recebe mensagens no Microsoft Teams via Graph API (app-only auth). Manda em channels com mention opcional, polla respostas, descobre team/channel IDs. Credenciais ficam no Vault (slug microsoft-teams)."
license: MIT
allowed-tools:
  - Bash(python /opencode-runtime/.opencode/skills/intelliforce-teams/scripts/teams.py *)
  - Read
---

# IntelliForce Teams — mensagens no Microsoft Teams

Skill que se comunica com Microsoft Teams via Graph API usando autenticação
**application** (sem usuário humano logado). Lê credenciais do Cofre, gera
access_token via Azure AD e envia/recebe mensagens em channels.

## Pré-requisitos

### 1. Vault — secret `microsoft-teams` com 3 campos

| Campo | De onde vem |
|---|---|
| `client_id` | Application (client) ID do App Registration no Azure AD |
| `client_secret` | Client Secret (Certificates & secrets) |
| `tenant_id` | Directory (tenant) ID |

Cadastrar pela UI `/vault` → Novo segredo → slug `microsoft-teams` → 3
campos. Tudo num único secret pra rotação atômica.

### 2. Azure AD App Registration — permissions Application

No Azure Portal → App Registration → API Permissions → Add →
Microsoft Graph → **Application permissions** (não Delegated):

| Permission | Pra quê |
|---|---|
| `Team.ReadBasic.All` | Listar teams (resolver nome → ID, listen, send) |
| `Channel.ReadBasic.All` | Listar channels |
| `ChannelMessage.Read.All` | Ler mensagens (pra `listen`) |
| `User.Read.All` | Resolver UPN → user_id (pra mention) |

Depois de adicionar: **Grant admin consent** (botão azul). Sem isso, todas
as chamadas retornam 403.

### 3. Teams App package — RSC pra `send` em channel

⚠️ **CRÍTICO — leia antes de sugerir qualquer coisa ao user:**

A permission **`ChannelMessage.Send.Group` NÃO existe** como Application
permission no Azure Portal. Se você procurar em **Add a permission →
Microsoft Graph → Application permissions**, ela **não vai aparecer**.
Ela é **RSC-only** (Resource-Specific Consent), declarável apenas em
**manifest de Teams App package**.

**Não sugira ao user "vai no Azure e adiciona ChannelMessage.Send.Group"
— isso é caça-fantasma, ela não está lá.** O caminho correto é:

1. Gerar o package customizado em `tools/teams-app-package/`:
   ```bash
   cd tools/teams-app-package
   python make-package.py --client-id <CLIENT_ID>
   ```
   (Output: `intelliforce-teams.zip`)
2. Upload em **https://admin.teams.microsoft.com → Teams apps →
   Manage apps → Upload new app**.
3. Adicionar app no Team alvo: Teams desktop → Team → **Manage team →
   Apps → More apps → IntelliForce → Add**.

Sem esses 3 passos, `send` em channel sempre retornará 403, mesmo com
admin consent dado pra todas as Application permissions disponíveis no
portal.

Detalhes em `tools/teams-app-package/README.md`.

### Quando o user reportar `PERMISSION_DENIED` no `send`

Sequência **obrigatória** de diagnóstico (não chute):

1. `list-teams` funciona? Se não, o problema é Application permissions
   (Team.ReadBasic.All) ou auth — direcione pro Azure Portal.
2. `list-teams` funciona mas `send` não? Então o problema é RSC. Não
   é coisa do Azure Portal — é o Teams App package. Direcione pro
   `tools/teams-app-package/`.
3. Se o user já uploadou o package e ainda dá 403: provavelmente o
   app ainda não foi adicionado ao Team alvo (passo 3 acima). RSC é
   por-Team, não por-tenant.

## Comandos

### `send` — manda mensagem em channel

```bash
python .../teams.py send \
    --team "<team_id|displayName>" \
    --channel "<channel_id|displayName>" \
    --message "Texto da mensagem" \
    [--mention <upn-da-pessoa>] \
    [--subject "Título"] \
    [--html] \
    [--skill <slug-da-skill-que-chama>]
```

Aceita **UUID ou nome** em `--team` e `--channel` (resolve via Graph).
`--mention` recebe e-mail/UPN da pessoa — ela é notificada igual a um @ no
chat. `--html` usa contentType=html (default é text). `--skill` default é
`intelliforce-teams`; outras skills passam o slug delas pro audit do
Vault ficar granular.

**Output (stdout, JSON):**

```json
{
  "ok": true,
  "id": "1735900000000",
  "createdDateTime": "2026-05-04T20:00:00.000Z",
  "webUrl": "https://teams.microsoft.com/l/message/...",
  "team_id": "5c3dc897-...",
  "channel_id": "19:b5ac...@thread.tacv2"
}
```

### `listen` — espera mensagem nova (polling)

```bash
python .../teams.py listen \
    --team "<team_id|displayName>" \
    --channel "<channel_id|displayName>" \
    [--since <iso8601>] \
    [--timeout 300] \
    [--poll-interval 15] \
    [--exclude-self]
```

Polla `/teams/{id}/channels/{id}/messages?$top=20` a cada `--poll-interval`
segundos até que apareça mensagem com `createdDateTime > since` (default:
agora). Retorna a lista (1+ mensagens) e sai com 0. Se nada chegar até
`--timeout`, sai com **3** + stderr `TIMEOUT: ...`.

`--exclude-self` filtra mensagens do próprio app (evita auto-loop em fluxos
"manda + escuta"). Bot conversation patterns típicos:

```bash
# Manda e espera resposta no mesmo channel
python .../teams.py send --team Foo --channel Bar --message "Aprova?" --mention chefe@empresa.com
python .../teams.py listen --team Foo --channel Bar --timeout 600 --exclude-self
```

### `list-teams` / `list-channels` / `resolve`

```bash
python .../teams.py list-teams                # array de {id, name, description}
python .../teams.py list-channels --team Foo  # array de {id, name, ...}
python .../teams.py resolve --team Foo --channel Bar  # {team_id, channel_id}
```

Útil pra descobrir IDs antes de cadastrar workflows. `resolve` aceita
`--channel` opcional.

## Erros (stderr categóricos)

| Stderr | Causa | Ação |
|---|---|---|
| `VAULT_MISSING` | Secret `microsoft-teams` não cadastrado | Criar em /vault |
| `VAULT_MISSING_FIELDS: ...` | Algum campo faltando | Recadastrar com 3 campos |
| `AUTH_ERROR_400: invalid_client` | client_secret expirado/errado | Gerar novo no Azure |
| `AUTH_ERROR_401: ...` | tenant_id ou client_id errados | Conferir IDs |
| `PERMISSION_DENIED (Authorization_RequestDenied)` | Falta admin consent OU RSC no Team | Conferir permissions |
| `NOT_FOUND` | team_id ou channel_id inválido / app sem acesso | `list-teams` pra ver disponíveis |
| `TEAM_NOT_FOUND: 'xyz'. Disponíveis: [...]` | Nome do team não bate | Conferir spelling |
| `CHANNEL_NOT_FOUND: 'xyz'` | Channel não existe no team | `list-channels --team X` |
| `TIMEOUT` | listen sem mensagem nova até timeout | Aumentar `--timeout` |
| `NETWORK_ERROR: ...` | Sem internet ou Graph offline | Retry |

Exit codes: 0 sucesso · 1 erro recuperável · 2 erro de uso · 3 timeout

## Limitações conhecidas (app-only auth)

- ❌ **DM 1:1 não suportado** — Graph proíbe app-only postar em chat 1:1
  sem instalação prévia + RSC. Workaround: mandar no channel com
  `--mention <upn>` (pessoa recebe notificação igual DM).
- ❌ **Webhooks/subscription real-time**: precisariam endpoint público.
  Esta skill só polla.
- ⚠️ **Latência do listen**: limitada pelo `--poll-interval` (default 15s).
  Pra menos: `--poll-interval 5` (mais carga).

## Padrão de uso em outras skills

Skill que precisa notificar/perguntar via Teams:

```python
import json, subprocess, sys

TEAMS = "/opencode-runtime/.opencode/skills/intelliforce-teams/scripts/teams.py"
TEAM = "Digital Employee"     # ou UUID
CHANNEL = "Digital Employee"  # ou ID 19:...@thread.tacv2

def notificar(msg: str, skill_slug: str, mention: str | None = None) -> str:
    cmd = [
        "python", TEAMS, "send",
        "--team", TEAM, "--channel", CHANNEL,
        "--message", msg, "--skill", skill_slug,
    ]
    if mention:
        cmd.extend(["--mention", mention])
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if r.returncode != 0:
        print(r.stderr.strip(), file=sys.stderr)
        sys.exit(1)
    return json.loads(r.stdout)["id"]


def aguardar_resposta(skill_slug: str, timeout: int = 600) -> dict | None:
    r = subprocess.run(
        ["python", TEAMS, "listen",
         "--team", TEAM, "--channel", CHANNEL,
         "--timeout", str(timeout), "--exclude-self",
         "--skill", skill_slug],
        capture_output=True, text=True, timeout=timeout + 30,
    )
    if r.returncode == 3:  # timeout
        return None
    if r.returncode != 0:
        print(r.stderr.strip(), file=sys.stderr)
        sys.exit(1)
    msgs = json.loads(r.stdout)
    return msgs[0] if msgs else None


# Uso:
notificar("Aprovar reposição de estoque do produto X?",
          skill_slug="monitor-estoque",
          mention="gerente@empresa.com")
resposta = aguardar_resposta(skill_slug="monitor-estoque", timeout=900)
if resposta and "sim" in resposta["content"].lower():
    pass  # ... aprovado ...
```

## Channel padrão do projeto: "Digital Employee"

```
team_id    = 5c3dc897-8eb0-4036-b087-442b0d3c3f2c
channel_id = 19:b5ac149259034f8b9eb45ea6a20a0338@thread.tacv2
```

(IDs públicos — não são secrets, vêm da URL do channel.)

## Setup inicial — passo a passo

1. Cadastrar `microsoft-teams` no Vault com 3 campos.
2. Adicionar permissions Application no App Registration + admin consent.
3. Adicionar o app ao Team alvo (Manage team → Apps).
4. Validar com:
   ```bash
   python .../teams.py list-teams --skill intelliforce-teams
   ```
   Se retornar array com seus teams: tudo OK. Se 403: revisar passos 2-3.
5. Mandar uma mensagem teste:
   ```bash
   python .../teams.py send \
       --team "Digital Employee" \
       --channel "Digital Employee" \
       --message "Hello from IntelliForce!"
   ```
