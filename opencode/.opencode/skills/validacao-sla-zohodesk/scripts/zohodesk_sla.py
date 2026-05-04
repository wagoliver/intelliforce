#!/usr/bin/env python3
"""zohodesk_sla.py — Consulta chamados no Zoho Desk e valida SLA."""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timedelta
from typing import Any

# ---------------------------------------------------------------------------
# Mock data — substituir por chamada real ao Zoho Desk quando as credenciais
# estiverem configuradas.
# ---------------------------------------------------------------------------

MOCK_TICKETS = [
    {
        "id": "TK-10234",
        "subject": "Servidor xOne Cloud instável",
        "priority": "Alta",
        "sla_deadline": (datetime.now() + timedelta(minutes=45)).isoformat(),
        "status": "Aberto",
    },
    {
        "id": "TK-10235",
        "subject": "Erro 500 no endpoint /api/v2/health",
        "priority": "Crítica",
        "sla_deadline": (datetime.now() - timedelta(minutes=10)).isoformat(),
        "status": "Em andamento",
    },
    {
        "id": "TK-10236",
        "subject": "Solicitação de acesso ao painel",
        "priority": "Baixa",
        "sla_deadline": (datetime.now() + timedelta(hours=5)).isoformat(),
        "status": "Aberto",
    },
]


def _sla_status(ticket: dict[str, Any]) -> str:
    """Classifica o ticket baseado no tempo restante do SLA."""
    deadline = datetime.fromisoformat(ticket["sla_deadline"])
    remaining = deadline - datetime.now()
    if remaining.total_seconds() < 0:
        return "breached"
    if remaining.total_seconds() < 3600:  # menos de 1h
        return "warning"
    return "ok"


def cmd_check_sla(args: argparse.Namespace) -> int:
    results = []
    for t in MOCK_TICKETS:
        results.append({
            "id": t["id"],
            "subject": t["subject"],
            "priority": t["priority"],
            "sla_deadline": t["sla_deadline"],
            "sla_status": _sla_status(t),
            "status": t["status"],
        })
    print(json.dumps(results, indent=2, ensure_ascii=False, default=str))
    return 0


def cmd_get_ticket(args: argparse.Namespace) -> int:
    for t in MOCK_TICKETS:
        if t["id"] == args.ticket_id:
            t["sla_status"] = _sla_status(t)
            print(json.dumps(t, indent=2, ensure_ascii=False, default=str))
            return 0
    print(f"Ticket {args.ticket_id} não encontrado", file=sys.stderr)
    return 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Validação de SLA — Zoho Desk")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_check = sub.add_parser("check-sla")
    p_check.set_defaults(func=cmd_check_sla)

    p_get = sub.add_parser("get-ticket")
    p_get.add_argument("ticket_id")
    p_get.set_defaults(func=cmd_get_ticket)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
