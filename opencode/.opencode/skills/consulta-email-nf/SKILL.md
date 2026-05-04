---
name: consulta-email-nf
description: Consulta emails em busca de notas fiscais emitidas contra a Arctica.
allowed-tools:
  - Bash(python /opencode-runtime/.opencode/skills/consulta-email-nf/scripts/email_nf.py *)
---

# Consulta de Email — Notas Fiscais Arctica

Consulta a caixa de email da Arctica via IMAP buscando notas fiscais recentes emitidas contra a empresa.

## Uso

```bash
# Buscar NFs dos últimos 7 dias
python /opencode-runtime/.opencode/skills/consulta-email-nf/scripts/email_nf.py buscar --empresa "Arctica" --periodo "7d"

# Buscar NFs de um mês específico
python /opencode-runtime/.opencode/skills/consulta-email-nf/scripts/email_nf.py buscar --empresa "Arctica" --periodo "2026-04"
```

## Output

Retorna um JSON com a lista de notas fiscais encontradas nos emails, contendo:
- `nf_id`: Identificador da nota
- `valor`: Valor total da NF
- `data_emissao`: Data de emissão
- `fornecedor`: Nome do fornecedor
- `assunto_email`: Assunto do email original

## Credenciais

O script busca automaticamente as credenciais IMAP no Cofre usando o slug `email-arctica-imap`.
