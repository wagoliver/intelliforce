---
name: consulta-itsm
description: Consulta chamados (tickets) de ITSM por status, prioridade, fila ou solicitante. Retorna JSON estruturado com lista de chamados encontrados, incluindo id, título, prioridade, status, solicitante e data de abertura.
license: MIT
allowed-tools:
  - Bash(python scripts/itsm_client.py *)
  - Read
metadata:
  audience: agentes-itsm
  domain: suporte-ti
---

# Consulta ITSM

Quando precisar consultar chamados do ITSM:

## Como executar

Rode o script Python que abstrai a chamada ao sistema ITSM:

```bash
python scripts/itsm_client.py [opções]
```

## Opções suportadas

- `--status <status>` — filtra por status (open, in_progress, resolved, closed)
- `--priority <P1|P2|P3|P4>` — filtra por prioridade
- `--queue <fila>` — filtra por fila (suporte-n1, suporte-n2, infra, etc.)
- `--limit <N>` — máximo de resultados (default: 20)
- `--format json` — sempre use JSON pra parse estruturado

## Exemplo

```bash
python scripts/itsm_client.py --status open --priority P1 --limit 10 --format json
```

## Output esperado

```json
{
  "tickets": [
    {
      "id": "INC-12345",
      "title": "Servidor de produção fora do ar",
      "priority": "P1",
      "status": "open",
      "queue": "infra",
      "requester": "joao.silva@cliente.com",
      "opened_at": "2026-05-02T08:30:00Z",
      "last_updated": "2026-05-02T09:15:00Z"
    }
  ],
  "total": 1
}
```

## Tratamento de erro

Se o script retornar exit code não-zero, leia o stderr pra entender o erro e:
- **Conexão falhou:** marque a tarefa como `inconclusivo` e escale
- **Sem resultados:** retorne lista vazia, não escale
- **Permissão negada:** marque como erro de configuração

## Notas

Este é um skill de exemplo — atualmente o script retorna **dados simulados (mock)** pra demonstração. Em produção, conecta na API real do ITSM (ServiceNow, Jira Service Management, etc.).
