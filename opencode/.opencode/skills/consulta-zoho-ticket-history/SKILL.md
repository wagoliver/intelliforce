---
name: consulta-zoho-ticket-history
description: Busca o histórico completo (comentários, mudanças de status, atualizações de campo) de um ticket específico no Zoho Desk e retorna JSON.
allowed-tools:
  - Bash(python /opencode-runtime/.opencode/skills/consulta-zoho-tickets/scripts/zoho_ticket_history.py)
  - Read
---

# Consulta Zoho Ticket History

Skill que conecta ao Zoho Desk via OAuth 2.0, renova o access token em runtime, e busca o histórico completo de um ticket específico — incluindo comentários, mudanças de status e atualizações de campo.

## Pré-requisitos (Vault)

Esta skill depende de **1 secret multi-campo** cadastrado no Cofre (`/vault`):

| Slug | Campos |
|------|--------|
| `zoho` | `client_id`, `client_secret`, `refresh_token` |

- **`client_id`** — Client ID da aplicação OAuth no Zoho
- **`client_secret`** — Client Secret da aplicação OAuth no Zoho
- **`refresh_token`** — Refresh Token original (não expira)

Se o secret ou algum campo faltar, o script falha com erro categórico.

## Uso

```bash
# Busca o histórico pelo número visível do ticket (lookup automático do ID interno)
python /opencode-runtime/.opencode/skills/consulta-zoho-tickets/scripts/zoho_ticket_history.py --ticket-number 1913

# Ou usa o ID interno diretamente (sem lookup)
python /opencode-runtime/.opencode/skills/consulta-zoho-tickets/scripts/zoho_ticket_history.py --ticket-id 658772000020421294

# Inclui comentários manuais
python /opencode-runtime/.opencode/skills/consulta-zoho-tickets/scripts/zoho_ticket_history.py --ticket-number 1913 --with-comments

# Inclui threads (trocas de e-mail com resumo)
python /opencode-runtime/.opencode/skills/consulta-zoho-tickets/scripts/zoho_ticket_history.py --ticket-number 1913 --with-threads

# Inclui tudo
python /opencode-runtime/.opencode/skills/consulta-zoho-tickets/scripts/zoho_ticket_history.py --ticket-number 1913 --with-comments --with-threads
```

Os dois argumentos (`--ticket-number` e `--ticket-id`) são mutuamente exclusivos.
Use `--ticket-number` quando souber apenas o número visível do ticket — o script
faz o lookup do ID interno automaticamente.

A flag `--with-comments` e opcional. Quando presente, o script tambem consulta
o endpoint `/tickets/{id}/comments` e inclui os comentarios com corpo completo
no output.

## Output

JSON estruturado com chaves condicionais:

```json
{
  "history": [
    {
      "name": "Ticket_Updated",
      "eventTime": "2026-06-05T16:13:38.000Z",
      "changes": [{"field": "Status", "oldValue": "Open", "newValue": "Waiting on Customer"}],
      "agentName": "Vanessa Oliveira"
    }
  ],
  "comments": [
    {
      "id": "...",
      "content": "Texto do comentario manual...",
      "commenter": {"name": "Integracao Jira", "type": "AGENT"},
      "isPublic": false
    }
  ],
  "threads": [
    {
      "id": "...",
      "channel": "EMAIL",
      "direction": "out",
      "summary": "Resumo do e-mail...",
      "author": {"name": "Vanessa Oliveira", "type": "AGENT"},
      "createdTime": "2026-06-05T16:13:37.000Z",
      "visibility": "public"
    }
  ]
}
```

- `history`: eventos do ticket (sempre presente) - mudancas de status, SLA, notificacoes, etc.
- `comments`: comentarios manuais (apenas quando `--with-comments`) - notas internas, integracoes Jira
- `threads`: trocas de e-mail (apenas quando `--with-threads`) - comunicacoes com o cliente

Campos de `threads`:
- `direction`: "in" (do cliente) ou "out" (do analista)
- `channel`: "EMAIL", "WEB", "PHONE", etc.
- `summary`: resumo do conteudo da mensagem
- `author`: quem enviou (com `type`: "AGENT" ou "END_USER")

Sem as flags, apenas a chave `history` aparece no output.

## Notas

- Token eh renovado em memoria a cada execucao. Nada persistido em disco.
- O lookup por `--ticket-number` varre a lista de tickets paginada ate
  encontrar o match.
- Comentarios internos (private notes) sao incluidos no output.
- Erros de autenticacao ou ticket inexistente sao reportados em stderr
  com codigo de saida nao-zero.
