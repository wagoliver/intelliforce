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
```

Os dois argumentos são mutuamente exclusivos. Use `--ticket-number` quando souber apenas o número visível do ticket — o script faz o lookup do ID interno automaticamente.

## Output

JSON bruto retornado pela API do Zoho Desk, contendo um array com entradas de histórico:
- Comentários adicionados (internos e públicos)
- Mudanças de status
- Atualizações de campo (owner, due date, prioridade, etc.)
- Regras de notificação aplicadas
- Eventos de SLA (vencimento, recálculo)

## Notas

- Token é renovado em memória a cada execução. Nada persistido em disco.
- O lookup por `--ticket-number` varre a lista de tickets paginada até encontrar o match.
- Erros de autenticação ou ticket inexistente são reportados em stderr com código de saída não-zero.
