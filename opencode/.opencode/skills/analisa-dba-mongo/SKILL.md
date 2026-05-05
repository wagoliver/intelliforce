---
name: analisa-dba-mongo
description: Consulta a coleção company_parameters do MongoDB xone-saas para analisar cadastros de organizações, convertendo timestamps para GMT-3.
allowed-tools:
  - Bash(python /opencode-runtime/.opencode/skills/analisa-dba-mongo/scripts/mongodb-query.py *)
---

# Analisa DBA - Mongo

Skill de leitura no MongoDB `xone-saas`, focada inicialmente na coleção `company_parameters`.
Utilizada para monitorar cadastros de organizações, verificar datas de criação e filtrar registros.

## Pré-requisitos (Vault)
Depende do secret `mongodb` (campo `strconn`) cadastrado no Cofre.

## Uso
```bash
# Últimas 4 organizações cadastradas
python /opencode-runtime/.opencode/skills/analisa-dba-mongo/scripts/mongodb-query.py --limit 4

# Filtrar por organization_id
python /opencode-runtime/.opencode/skills/analisa-dba-mongo/scripts/mongodb-query.py --filter '{"organization_id": 330}'

# Ordenar por outro campo
python /opencode-runtime/.opencode/skills/analisa-dba-mongo/scripts/mongodb-query.py --sort "organization_id:1"
```

## Parâmetros
- `--filter`: JSON com filtros MongoDB (default: `{}`)
- `--sort`: `campo:direcao` (1 ou -1, default: `created_at:-1`)
- `--limit`: Limite de documentos (default: `10`)
- `--fields`: Campos a retornar, separados por vírgula (default: todos)

## Notas
- Todos os timestamps `created_at` são convertidos automaticamente de UTC para GMT-3.
- Acesso estritamente read-only.
- Skill em evolução: novas coleções e filtros serão adicionados conforme necessidade.
