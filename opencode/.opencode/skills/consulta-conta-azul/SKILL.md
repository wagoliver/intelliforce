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

# Listar todos os pagamentos realizados
python /opencode-runtime/.opencode/skills/consulta-conta-azul/scripts/conta_azul.py pagamentos-realizados
```

## Output

### Lançamentos (`buscar`)
Retorna um JSON com a lista de lançamentos financeiros, contendo:
- `lancamento_id`: ID interno do Conta Azul
- `valor`: Valor do lançamento
- `data_pagamento`: Data prevista ou realizada do pagamento
- `fornecedor`: Nome do fornecedor
- `status`: Status do lançamento (pago, pendente, etc.)

### Pagamentos Realizados (`pagamentos-realizados`)
Retorna um JSON com a lista de pagamentos já executados, contendo:
- `pagamento_id`: ID interno do pagamento
- `lancamento_id`: ID do lançamento associado
- `valor`: Valor pago
- `data_realizada`: Data em que o pagamento foi efetivado
- `fornecedor`: Nome do fornecedor
- `meio_pagamento`: TED, DOC, Boleto, etc.
- `status`: Status do pagamento (liquidado, etc.)

## Credenciais

O script busca automaticamente o token de API no Cofre usando o slug `conta-azul-api-token`.
