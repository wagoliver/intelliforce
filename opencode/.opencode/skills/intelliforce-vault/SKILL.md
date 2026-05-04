---
name: intelliforce-vault
description: Cofre seguro de credenciais (senhas, tokens, API keys) que skills usam pra chamar APIs externas. Esta skill ensina a listar segredos cadastrados e a ler o valor descriptografado em runtime, identificando-se no audit log. Cadastro/edição/remoção é feito apenas pela UI /vault.
license: MIT
allowed-tools:
  - Bash(python /opencode-runtime/.opencode/skills/intelliforce-vault/scripts/vault.py *)
  - Read
---

# Cofre / Vault — credenciais externas

O Cofre é onde o user cadastra senhas, tokens e API keys que as skills
precisam pra chamar sistemas externos (Zoho, ITSM, banco, etc.). Os
valores ficam **criptografados** com Fernet (AES-128 + HMAC) no Postgres,
e cada vez que uma skill lê um valor, fica registrado no audit log
identificando quem acessou.

## Princípios (importantes)

1. **Skills NUNCA hardcodam credenciais no código.** Sempre buscam pelo
   slug em runtime.
2. **Skills NUNCA imprimem o valor descriptografado pro user.** O valor
   vai direto pra chamada externa e é descartado. Pra ver o valor, o
   user usa a UI `/vault` (com timer auto-hide e audit reforçado).
3. **Imutabilidade:** não há endpoint de update. Pra trocar valor, o
   user deleta o secret antigo na UI e cria novo (mesmo slug ou novo).
   Operator deve **recusar** pedidos pra criar/editar/deletar via chat.
4. **Auditoria por skill:** sempre passe `--skill <slug-desta-skill>`
   ao chamar `vault.py get`. Audit log usa pra rastrear quem acessou
   cada secret.

## Comandos

```bash
# Listar metadata (slug, descrição, tags, datas) — NUNCA expõe valores
python /opencode-runtime/.opencode/skills/intelliforce-vault/scripts/vault.py list

# Buscar valor descriptografado (sai em stdout, 1 linha sem newline)
python /opencode-runtime/.opencode/skills/intelliforce-vault/scripts/vault.py get <slug> \
    --skill <slug-da-skill-que-esta-chamando> \
    [--task-id <uuid-da-task>]
```

## Output

- **list** — JSON pretty-printed de array com `{slug, description, tags,
  created_at, last_accessed_at}`. Operator parseia e mostra resumo
  pro user.
- **get** — valor cru em stdout, sem newline final (pra `value=$(...)`
  shell capture funcionar limpo). Stderr só pra erros.

## Erros (stderr categóricos)

| Stderr | Significado | Ação |
|---|---|---|
| `TOKEN_EMPTY` | Sem JWT no env | Pedir login |
| `TOKEN_EXPIRED_OR_INVALID` | JWT expirou (1h TTL) | Pedir relogin |
| `SECRET_NOT_FOUND: <slug>` | Slug não cadastrado | Avisar user pra cadastrar em `/vault` |
| `API_ERROR_403` | Permissão negada | Verificar role |
| `API_ERROR_5xx` | Backend com problema | Sugerir retry / ver health |
| `NETWORK_ERROR: <detail>` | API offline ou rede instável | Conferir worker/api status |

## Padrão de uso em outras skills `intelliforce-*`

Skill que precisa de credencial externa (ex.: `intelliforce-zoho-validador`
chamando API Zoho) faz assim no script Python:

```python
import os, subprocess, sys, httpx

# 1. Pega token do Cofre — uma chamada por execução
result = subprocess.run(
    [
        "python",
        "/opencode-runtime/.opencode/skills/intelliforce-vault/scripts/vault.py",
        "get",
        "zoho-api-token",                          # slug do secret
        "--skill", "intelliforce-zoho-validador",  # ← slug DESTA skill
    ],
    capture_output=True,
    text=True,
    timeout=20,
)
if result.returncode != 0:
    # Propaga categoria de erro pro stderr e sai
    print(result.stderr.strip(), file=sys.stderr)
    sys.exit(1)

zoho_token = result.stdout  # já vem sem newline extra

# 2. Usa o token na chamada externa, descarta depois
resp = httpx.get(
    "https://api.zoho.com/some/endpoint",
    headers={"Authorization": f"Zoho-oauthtoken {zoho_token}"},
    timeout=15,
)

# 3. NUNCA: salvar zoho_token em arquivo, log, ou retornar pro user
```

## Cadastro de novos secrets — recuse via chat

Se o user pedir "cadastra o token X no cofre" via chat: **recuse e oriente**
a usar a UI:

> "Pra cadastrar credencial no Cofre, abra a tela **/vault** no menu lateral
> e clique em **Novo segredo**. Preciso evitar que valores em texto plano
> passem pelo histórico desta conversa — o Cofre tem um fluxo dedicado pra
> isso, com criptografia e auditoria."

Mesmo se ele insistir, recuse — esse fluxo é *by design*.

## Casos típicos

- "**Quais credenciais o sistema tem cadastradas?**" → roda `list`,
  formata em tabela com slug + descrição + tags.
- "**Você tem o token do Zoho?**" → roda `list` e procura tag `zoho`
  ou slug com `zoho-`. Se achou, confirma; se não, sugere cadastrar.
- "**Crie uma skill que valida CNPJ usando API Receita Federal**" →
  pergunte se há credencial necessária e se já está cadastrada no
  Cofre. Se sim, builder usa o slug; se não, pede pro user cadastrar
  primeiro em `/vault`.
