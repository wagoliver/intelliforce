---
name: intelliforce-teams
description: "Manda mensagens em channels do Microsoft Teams via Power Automate webhook (one-way). Suporta texto simples (Adaptive Card mínimo gerado automaticamente) ou cards customizados. URL do trigger fica criptografada no Vault. Sem necessidade de Azure AD App, Graph API ou RSC."
license: MIT
allowed-tools:
  - Bash(python /opencode-runtime/.opencode/skills/intelliforce-teams/scripts/teams.py *)
  - Read
---

# IntelliForce Teams — notificações via Power Automate webhook

Skill que posta mensagens em channels do Microsoft Teams disparando um
**flow do Power Automate** que recebe Adaptive Card e posta no
channel-alvo. Substitui completamente o caminho Microsoft Graph API que
exige Azure AD App + RSC + admin consent + install no team — coisa que
muitos tenants corporativos bloqueiam por policy.

## Como funciona

```
[skill X] ─┐
           │ subprocess
           ▼
       [teams.py send]
           │ lê URL do Vault (slug teams-webhook-*)
           │
           ▼
       [POST https://...powerautomate.com/...]
           │
           ▼
   [Power Automate flow]
           │ "When HTTP request received" → "Post card in chat or channel"
           ▼
       [channel do Teams]
```

A URL do trigger HTTP do Power Automate carrega um SAS token (`sig=...`)
que autentica a chamada — não precisa OAuth, não precisa Azure AD App.
Trata-se do mesmo padrão dos antigos Incoming Webhooks, mas via Power
Automate (Microsoft está deprecando os webhooks legados; Power Automate
é o substituto oficial).

## Pré-requisitos

### 1. Power Automate flow (1 por channel)

Pra cada channel onde quiser postar, crie 1 flow:

1. Abre **https://make.powerautomate.com**
2. **Create** → **Instant cloud flow**
3. Trigger: **When a HTTP request is received** (deixa o body schema vazio
   ou genérico — o trigger aceita qualquer JSON)
4. Add step: **Microsoft Teams** → **Post card in a chat or channel**
   - **Post as**: User (ou Flow bot, se sua org permitir)
   - **Post in**: Channel
   - **Team**: selecione (ex.: *xOne - Notificações Sistêmicas*)
   - **Channel**: selecione (ex.: *Digital Employee*)
   - **Adaptive Card**: cole `triggerBody()` (expressão) — passa o body
     do POST direto pro card
5. Save
6. Volta no trigger HTTP, copia a **URL** que aparece (formato:
   `https://default<tenant>.environment.api.powerplatform.com/.../triggers/manual/paths/invoke?...&sig=...`)

### 2. Cadastrar URL no Vault

Na UI `/vault` → **Novo segredo**:

| Slug | Campos |
|---|---|
| `teams-webhook-digital-employee` | `url` (campo único) |

Cole a URL no campo `url`. Pra outros channels: crie outro flow + outro
secret com slug diferente (`teams-webhook-<nome-do-channel>`).

## Comandos

### `send` — mensagem texto simples

```bash
python .../teams.py send \
    --message "Texto da mensagem" \
    [--subject "Título"] \
    [--footer "Footer custom"] \
    [--webhook-secret <slug-no-vault>] \
    [--skill <slug-da-skill-que-chama>]
```

Monta um Adaptive Card mínimo internamente:

```
[Subject (bold, medium)]   ← se passado
[Texto da mensagem (wrap)]
[via IntelliForce · 2026-05-04 18:00 UTC]   ← footer auto, override com --footer
```

`--webhook-secret` default: `teams-webhook-digital-employee`. Pra outro
channel, passa o slug do secret correspondente.

`--skill` default: `intelliforce-teams`. Outras skills passam o slug
delas pra audit do Vault ficar granular.

**Output (stdout, JSON):**

```json
{
  "ok": true,
  "status": 202,
  "sent_at": "2026-05-04T18:00:00.000000+00:00"
}
```

### `send-card` — Adaptive Card customizado

Pra notificações ricas (FactSet, Image, ColumnSet, Action.OpenUrl, etc.):

```bash
# de arquivo
python .../teams.py send-card --card-file /tmp/my-card.json

# inline (escape aspas conforme shell)
python .../teams.py send-card --card-json '{"type":"AdaptiveCard","version":"1.4","body":[...]}'

# pipe via stdin
cat my-card.json | python .../teams.py send-card
```

⚠️ **Shape do JSON**: a raiz precisa ter `"type": "AdaptiveCard"` direto.
Se você copiou de um exemplo com wrapper `{"contentType": "...", "content": {...}}`,
o script desempacota automaticamente — mas o Power Automate flow espera
sem wrapper. Use https://adaptivecards.io/designer pra prototipar.

## Erros (stderr categóricos)

| Stderr | Causa | Ação |
|---|---|---|
| `VAULT_MISSING` | Secret do webhook não cadastrado | Criar em `/vault` |
| `VAULT_FIELD_MISSING` | Secret existe mas sem campo `url` | Recadastrar com campo `url` |
| `VAULT_FIELD_EMPTY` | Campo `url` vazio | Editar e colar URL |
| `WEBHOOK_UNAUTHORIZED (401/403)` | URL inválida ou expirada | Re-gerar URL no Power Automate, atualizar Vault |
| `WEBHOOK_NOT_FOUND (404)` | Flow deletado | Recriar flow |
| `WEBHOOK_BAD_REQUEST (400)` | Body inválido (geralmente shape de Adaptive Card) | Conferir card via designer |
| `CARD_INVALID_JSON` | JSON malformado em `--card-file`/`--card-json`/stdin | Validar JSON antes |
| `CARD_INVALID_SHAPE` | Raiz do JSON não tem `type: "AdaptiveCard"` | Tirar wrapper `{contentType, content}` |
| `CARD_INPUT_MISSING` | `send-card` sem nenhum input | Passar `--card-file`, `--card-json` ou pipe |
| `NETWORK_ERROR` | Sem internet ou Power Automate offline | Retry |

Exit codes: 0 sucesso · 1 erro de runtime · 2 erro de uso/input

## Limitações conhecidas

- ❌ **One-way**: webhook não recebe respostas. Pra fluxos do tipo
  "perguntar e esperar", precisa Graph API + RSC (ver
  `tools/teams-app-package/`).
- ❌ **1 webhook por channel**: cada channel-alvo precisa de seu
  próprio flow + secret no Vault. Não tem como mudar de channel
  dinamicamente sem trocar a URL.
- ❌ **Sem mention notificável**: Adaptive Card via Power Automate
  posta como "Flow bot" e mention de pessoa exige `msteams.entities`
  + UPN — possível mas não suportado nessa versão. Pra notificar
  alguém, mande via Graph com `--mention` (após resolver RSC).
- ⚠️ **SAS token na URL**: o `sig=...` da URL é o secret de auth. Se
  vazar, qualquer um pode disparar o flow. Por isso fica no Vault.
  Pra rotacionar: regenerar trigger no Power Automate (gera nova URL
  + sig), atualizar Vault.

## Padrão de uso em outras skills

Skill que precisa notificar via Teams:

```python
import json, subprocess, sys

TEAMS = "/opencode-runtime/.opencode/skills/intelliforce-teams/scripts/teams.py"

def notificar(
    message: str,
    skill_slug: str,
    *,
    subject: str | None = None,
    webhook_secret: str = "teams-webhook-digital-employee",
) -> dict:
    cmd = [
        "python", TEAMS, "send",
        "--message", message,
        "--webhook-secret", webhook_secret,
        "--skill", skill_slug,
    ]
    if subject:
        cmd.extend(["--subject", subject])
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if r.returncode != 0:
        print(r.stderr.strip(), file=sys.stderr)
        sys.exit(1)
    return json.loads(r.stdout)


# Uso:
notificar(
    "Estoque do produto X abaixo do mínimo (12 unidades). "
    "Recomenda-se reposição imediata.",
    skill_slug="monitor-estoque",
    subject="⚠️ Alerta de estoque crítico",
)
```

Pra Adaptive Card customizado (com FactSet, ColumnSet, etc.):

```python
def notificar_rico(card_dict: dict, skill_slug: str) -> dict:
    r = subprocess.run(
        [
            "python", TEAMS, "send-card",
            "--card-json", json.dumps(card_dict),
            "--skill", skill_slug,
        ],
        capture_output=True, text=True, timeout=30,
    )
    if r.returncode != 0:
        print(r.stderr.strip(), file=sys.stderr)
        sys.exit(1)
    return json.loads(r.stdout)
```

## Channel padrão do projeto

| Team | Channel | Webhook secret |
|---|---|---|
| xOne - Notificações Sistêmicas | Digital Employee | `teams-webhook-digital-employee` |

Outros channels: crie 1 flow + 1 secret nomeado consistentemente
(`teams-webhook-<channel-em-kebab-case>`).

## Quando preferir Graph API em vez deste webhook

Caminhos não atendidos por webhook (use Graph + RSC, ver
`tools/teams-app-package/README.md`):

- Receber respostas (`listen`)
- Listar teams/channels dinamicamente
- Mention de pessoa específica com notificação real
- Postar em chat 1:1 ou grupo (não só channel)

Pra todos os outros casos (notificações, alertas, relatórios, status
updates) o webhook é mais simples e não esbarra em policy de tenant.
