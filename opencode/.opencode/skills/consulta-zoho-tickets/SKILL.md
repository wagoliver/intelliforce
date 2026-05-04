---
name: consulta-zoho-tickets
description: Consulta tickets abertos (N1/N2) no Zoho Desk, renova token OAuth automaticamente e retorna dados estruturados em JSON.
allowed-tools:
  - Bash(python /opencode-runtime/.opencode/skills/consulta-zoho-tickets/scripts/zoho_tickets.py)
  - Read
---

# Consulta Zoho Tickets

Skill que conecta ao Zoho Desk via OAuth 2.0, renova o access token em runtime, lista tickets abertos de nível N1 e N2 e retorna um array JSON com detalhes enriquecidos (analista, organização, descrição limpa).

## Pré-requisitos (Vault)

Esta skill depende de **1 secret multi-campo** cadastrado no Cofre (`/vault`):

| Slug | Campos |
|------|--------|
| `zoho` | `client_id`, `client_secret`, `refresh_token` |

- **`client_id`** — Client ID da aplicação OAuth no Zoho |
- **`client_secret`** — Client Secret da aplicação OAuth no Zoho |
- **`refresh_token`** — Refresh Token original (não expira) |

Se o secret ou algum campo faltar, o script falha com erro categórico.

## Uso

```bash
# Executa a consulta e imprime JSON no stdout
python /opencode-runtime/.opencode/skills/consulta-zoho-tickets/scripts/zoho_tickets.py
```

## Output

Array JSON com objetos contendo:
- `ticketNumber`, `subject`, `status`, `statusType`
- `createdTime`, `classification`, `priority`
- `nivel_suporte`, `organizacao`
- `analista` (nome resolvido a partir do agent ID)
- `description` (HTML stripado)

## Notas

- Token é renovado em memória a cada execução. Nada persistido em disco.
- Filtra apenas tickets com `statusType != "Closed"` e `cf_nivel_de_suporte` em ("N1", "N2").
- Ordena por `ticketNumber` decrescente (mais recentes primeiro).
