#!/usr/bin/env python3
"""Cliente ITSM (mock) — retorna chamados simulados para validar o fluxo de skills.

Em produção, substituir pela integração real (ServiceNow, JSM, etc.).
"""
import argparse
import json
import random
import sys
from datetime import datetime, timedelta, timezone

# Pool de tickets fake pra demonstração
FAKE_TICKETS = [
    {
        "id": "INC-12345",
        "title": "Servidor de produção fora do ar",
        "priority": "P1",
        "status": "open",
        "queue": "infra",
        "requester": "joao.silva@cliente.com",
    },
    {
        "id": "INC-12346",
        "title": "Email não está enviando anexos",
        "priority": "P3",
        "status": "in_progress",
        "queue": "suporte-n1",
        "requester": "maria.souza@cliente.com",
    },
    {
        "id": "INC-12347",
        "title": "VPN lenta para Office 365",
        "priority": "P2",
        "status": "open",
        "queue": "suporte-n2",
        "requester": "pedro.costa@cliente.com",
    },
    {
        "id": "INC-12348",
        "title": "Solicitação de novo acesso ao ERP",
        "priority": "P4",
        "status": "open",
        "queue": "suporte-n1",
        "requester": "ana.lima@cliente.com",
    },
    {
        "id": "INC-12349",
        "title": "Banco de dados com lentidão",
        "priority": "P1",
        "status": "open",
        "queue": "infra",
        "requester": "carlos.alves@cliente.com",
    },
    {
        "id": "INC-12350",
        "title": "Impressora setor financeiro com erro",
        "priority": "P4",
        "status": "resolved",
        "queue": "suporte-n1",
        "requester": "lucia.fernandes@cliente.com",
    },
]


def main() -> int:
    parser = argparse.ArgumentParser(description="Consulta chamados ITSM (mock).")
    parser.add_argument("--status", help="Filtra por status (open, in_progress, resolved, closed)")
    parser.add_argument("--priority", help="Filtra por prioridade (P1, P2, P3, P4)")
    parser.add_argument("--queue", help="Filtra por fila")
    parser.add_argument("--limit", type=int, default=20, help="Máximo de resultados")
    parser.add_argument("--format", choices=["json"], default="json", help="Formato de saída")
    args = parser.parse_args()

    results = list(FAKE_TICKETS)
    if args.status:
        results = [t for t in results if t["status"] == args.status]
    if args.priority:
        results = [t for t in results if t["priority"] == args.priority]
    if args.queue:
        results = [t for t in results if t["queue"] == args.queue]

    results = results[: args.limit]

    # Adiciona timestamps simulados (recentes)
    now = datetime.now(timezone.utc)
    for t in results:
        opened_offset = timedelta(hours=random.randint(1, 72))
        t["opened_at"] = (now - opened_offset).isoformat()
        t["last_updated"] = (now - timedelta(minutes=random.randint(5, 600))).isoformat()

    output = {"tickets": results, "total": len(results)}
    print(json.dumps(output, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
