---
name: validacao-sla-zohodesk
description: Consulta chamados no Zoho Desk e valida se o SLA está próximo de vencer.
license: MIT
allowed-tools:
  - Bash(python /opencode-runtime/.opencode/skills/validacao-sla-zohodesk/scripts/zohodesk_sla.py *)
  - Read
---

# Validação de SLA — Zoho Desk

Consulta os tickets abertos no Zoho Desk e verifica se algum SLA está prestes a vencer ou já venceu.

## Como rodar

```bash
# Listar chamados com SLA crítico
python /opencode-runtime/.opencode/skills/validacao-sla-zohodesk/scripts/zohodesk_sla.py check-sla

# Verificar status de um chamado específico
python /opencode-runtime/.opencode/skills/validacao-sla-zohodesk/scripts/zohodesk_sla.py get-ticket <ticket_id>
```

## Configuração

O script lê as credenciais do Zoho Desk via variáveis de ambiente:
- `ZOHO_DESK_TOKEN` — access token da API
- `ZOHO_DESK_ORG_ID` — ID da organização

Até as credenciais reais serem configuradas, o script roda em **modo mock** retornando dados de exemplo.

## Output

JSON com lista de tickets, tempo restante de SLA e status (`ok`, `warning`, `breached`).
