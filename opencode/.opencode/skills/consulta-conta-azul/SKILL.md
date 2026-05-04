---
name: consulta-conta-azul
description: Consulta lançamentos e pagamentos no sistema Conta Azul.
allowed-tools:
  - Bash(python /opencode-runtime/.opencode/skills/consulta-conta-azul/scripts/conta_azul.py *)
---

# Consulta Conta Azul

Consulta o sistema financeiro Conta Azul para verificar lançamentos cadastrados, pagamentos e conciliação bancária.

## Uso

```bash
# Buscar lançamentos do último mês
python /opencode-runtime/.opencode/skills/consulta-conta-azul/scripts/conta_azul.py buscar --periodo "ultimo-mes"

# Buscar lançamentos de um mês específico
python /opencode-runtime/.opencode/skills/consulta-conta-azul/scripts/conta_azul.py buscar --periodo "2026-04"
```

## Output

Retorna um JSON com a lista de lançamentos financeiros, contendo:
- `lancamento_id`: ID interno do Conta Azul
- `valor`: Valor do lançamento
- `data_pagamento`: Data prevista ou realizada do pagamento
- `fornecedor`: Nome do fornecedor
- `status`: Status do lançamento (pago, pendente, etc.)

## Credenciais

O script busca automaticamente o token de API no Cofre usando o slug `conta-azul-api-token`.
