---
name: intelliforce-vault
description: Cofre seguro de credenciais. Cada secret carrega 1 ou mais campos key→value (ex.: zoho com client_id + client_secret + refresh_token), criptografados juntos no mesmo blob. Esta skill ensina a listar, ler campo específico ou todos de uma vez. Cadastro/edição/remoção é feito apenas pela UI /vault.
license: MIT
allowed-tools:
  - Bash(python /opencode-runtime/.opencode/skills/intelliforce-vault/scripts/vault.py *)
  - Read
---

# Cofre / Vault — credenciais multi-campo

O Cofre guarda credenciais que skills usam pra chamar APIs externas
(Zoho, AWS, OAuth, ITSM, banco, etc.). **Um secret = uma credencial
lógica**, podendo ter múltiplos campos relacionados.

Exemplo: a credencial Zoho tem 3 partes que SÓ funcionam juntas:

```
secret slug=zoho:
  client_id      = "1000.ABC..."
  client_secret  = "f6b9..."
  refresh_token  = "1000.xyz..."
```

Tudo é **criptografado junto no mesmo blob Fernet** (AES-128 + HMAC).
Rotação = delete + create do bundle inteiro = atualização atômica
(impossível ficar com `client_secret` novo e `refresh_token` velho).

## Princípios (importantes)

1. **Skills NUNCA hardcodam credenciais no código.** Sempre buscam por
   slug em runtime.
2. **Skills NUNCA imprimem valores descriptografados pro user.** O valor
   vai direto pra chamada externa e é descartado. Pra ver o valor, o
   user usa a UI `/vault`.
3. **Imutabilidade:** não há endpoint de update. Pra trocar um campo,
   o user deleta o secret e cria de novo (na UI). Operator deve
   **recusar** pedidos pra criar/editar/deletar via chat.
4. **Auditoria por campo:** sempre passe `--skill <slug-desta-skill>`.
   Audit log registra qual `field_accessed` foi lido (`client_id`,
   `refresh_token`, ou NULL = leu todos).

## Comandos

```bash
# Listar metadata de todos secrets (sem valores)
python /opencode-runtime/.opencode/skills/intelliforce-vault/scripts/vault.py list

# Ler 1 campo específico — recomendado pra audit granular
python /opencode-runtime/.opencode/skills/intelliforce-vault/scripts/vault.py get <slug> \
    --skill <slug-da-skill-que-esta-chamando> \
    --field <nome-do-campo> \
    [--task-id <uuid-da-task>]

# Ler todos os campos como JSON {key: value, ...}
python /opencode-runtime/.opencode/skills/intelliforce-vault/scripts/vault.py get <slug> \
    --skill <slug-da-skill> \
    --all-fields

# Atalho: secret com 1 só campo (sem --field/--all-fields)
# - se o secret tem 1 campo único, retorna o valor cru direto
# - se tem 2+, falha pedindo --field ou --all-fields
python /opencode-runtime/.opencode/skills/intelliforce-vault/scripts/vault.py get <slug> \
    --skill <slug-da-skill>
```

## Output (stdout)

| Comando                          | Stdout                                      |
|----------------------------------|---------------------------------------------|
| `list`                           | JSON pretty-printed (array de metadata)     |
| `get --field K`                  | valor cru de K (1 linha, sem newline final) |
| `get --all-fields`               | JSON `{"k1":"v1", ...}` em 1 linha          |
| `get` (atalho 1-campo)           | valor cru                                   |

Stderr só pra erros. Exit codes: 0 sucesso · 1 erro recuperável · 2 erro
de uso (params inválidos, secret ambíguo).

## Erros (stderr categóricos)

| Stderr | Significado | Ação |
|---|---|---|
| `TOKEN_EMPTY` | Sem JWT | Pedir login |
| `TOKEN_EXPIRED_OR_INVALID` | JWT expirou (1h TTL) | Pedir relogin |
| `SECRET_NOT_FOUND: <slug>` | Slug não cadastrado | Avisar user pra cadastrar em `/vault` |
| `API_ERROR_404: ...` | Campo não existe no secret | Listar `list` pra ver field_keys |
| `AMBIGUOUS_FIELDS: ...` | Secret tem 2+ campos e nem `--field` nem `--all-fields` foi passado | Adicionar a flag |
| `API_ERROR_403` | Permissão negada | Verificar role |
| `API_ERROR_5xx` | Backend com problema | Sugerir retry / ver health |
| `NETWORK_ERROR: ...` | API offline ou rede instável | Conferir worker/api status |

## Padrão de uso em outras skills `intelliforce-*`

### Caso multi-field (Zoho, AWS, OAuth)

Skill que precisa de várias credenciais relacionadas:

```python
import json, os, subprocess, sys, httpx

VAULT = "/opencode-runtime/.opencode/skills/intelliforce-vault/scripts/vault.py"

def get_zoho_credentials(skill_slug: str) -> dict[str, str]:
    """Pega client_id, client_secret e refresh_token do Cofre numa só chamada."""
    result = subprocess.run(
        ["python", VAULT, "get", "zoho", "--skill", skill_slug, "--all-fields"],
        capture_output=True, text=True, timeout=20,
    )
    if result.returncode != 0:
        print(result.stderr.strip(), file=sys.stderr)
        sys.exit(1)
    return json.loads(result.stdout)

# Uso na skill:
creds = get_zoho_credentials("intelliforce-zoho-validador")
# creds = {"client_id": "...", "client_secret": "...", "refresh_token": "..."}

# Refresh do access token (Zoho OAuth)
resp = httpx.post(
    "https://accounts.zoho.com/oauth/v2/token",
    data={
        "refresh_token": creds["refresh_token"],
        "client_id": creds["client_id"],
        "client_secret": creds["client_secret"],
        "grant_type": "refresh_token",
    },
    timeout=15,
)
access_token = resp.json()["access_token"]

# Usa access_token na chamada à API Zoho real
# ... resto do fluxo, NUNCA persistir creds em arquivo/log
```

### Caso single-field (token isolado)

Skill que precisa de só 1 credencial (ex.: API key simples):

```python
import subprocess, sys, httpx

VAULT = "/opencode-runtime/.opencode/skills/intelliforce-vault/scripts/vault.py"

def get_api_key(slug: str, skill_slug: str) -> str:
    result = subprocess.run(
        # Sem --field: atalho funciona se secret tem 1 só campo
        ["python", VAULT, "get", slug, "--skill", skill_slug],
        capture_output=True, text=True, timeout=20,
    )
    if result.returncode != 0:
        print(result.stderr.strip(), file=sys.stderr)
        sys.exit(1)
    return result.stdout

key = get_api_key("openai-key", "intelliforce-meu-cliente-openai")
resp = httpx.get("https://api.openai.com/v1/models",
                 headers={"Authorization": f"Bearer {key}"})
```

### Caso preciso só de 1 campo de secret multi-field

```python
result = subprocess.run(
    ["python", VAULT, "get", "zoho", "--skill", "intelliforce-zoho-validador",
     "--field", "refresh_token"],
    capture_output=True, text=True, timeout=20,
)
# stdout = "1000.xyz..." (só o refresh token, audit grava field_accessed=refresh_token)
```

## Cadastro de novos secrets — recuse via chat

Se o user pedir "cadastra zoho no cofre com esses tokens" via chat:
**recuse e oriente** a usar a UI:

> "Pra cadastrar credencial no Cofre, abra a tela **/vault** no menu
> lateral e clique em **Novo segredo**. Lá você adiciona quantos campos
> precisar (client_id, client_secret, refresh_token...) num único
> segredo. Preciso evitar que valores em texto plano passem pelo
> histórico desta conversa."

## Casos típicos que o operator deve saber lidar

- "**Quais credenciais o sistema tem cadastradas?**" → roda `list`,
  formata em tabela com slug + field_keys + descrição + tags.
- "**Você tem o token do Zoho?**" → roda `list`, procura tag `zoho` ou
  slug com `zoho`. Se achou, confirma os campos disponíveis; se não,
  sugere cadastrar.
- "**Crie uma skill que valida CNPJ usando API Receita Federal**" →
  pergunte se há credencial necessária e se está cadastrada. Se sim,
  builder usa o slug + flag apropriada (`--field` ou `--all-fields`).

## Estrutura no DB

- `secrets.field_keys: VARCHAR[]` — nomes dos campos (cleartext, não-sensível)
- `secrets.encrypted_value: BYTEA` — Fernet sobre `json.dumps({k: v, ...})`
- `secret_access_log.field_accessed: VARCHAR` — registra qual campo foi lido (NULL = todos)
