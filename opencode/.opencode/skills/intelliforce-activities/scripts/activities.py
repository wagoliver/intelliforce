#!/usr/bin/env python3
"""activities.py — CRUD de atividades + agendamento cron."""
from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any

import httpx


def _client() -> tuple[str, dict[str, str]]:
    token = os.environ.get("INTELLIFORCE_TOKEN", "").strip()
    base = os.environ.get("INTELLIFORCE_API_URL", "http://localhost:8000").rstrip("/")
    if not token:
        print("TOKEN_EMPTY", file=sys.stderr)
        sys.exit(1)
    return base, {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def _handle(resp: httpx.Response) -> Any:
    if resp.status_code == 401:
        print("TOKEN_EXPIRED_OR_INVALID", file=sys.stderr)
        sys.exit(1)
    if resp.status_code == 404:
        print(f"API_ERROR_404: {resp.text[:200]}", file=sys.stderr)
        sys.exit(1)
    if resp.status_code >= 400:
        print(f"API_ERROR_{resp.status_code}: {resp.text[:200]}", file=sys.stderr)
        sys.exit(1)
    if resp.status_code == 204:
        return {"deleted": True}
    try:
        return resp.json()
    except ValueError:
        return {"raw": resp.text}


def cmd_create(args: argparse.Namespace) -> int:
    base, headers = _client()
    payload: dict[str, Any] = {
        "name": args.name,
        "display_name": args.display_name,
    }
    if args.skill_code is not None:
        payload["skill_code"] = args.skill_code
    if args.target_count is not None:
        payload["target_agent_count"] = args.target_count
    if args.position is not None:
        payload["position"] = args.position
    if args.default_agent is not None:
        payload["default_agent_id"] = args.default_agent
    if args.schedule is not None:
        payload["schedule"] = args.schedule

    try:
        resp = httpx.post(
            f"{base}/departments/{args.dept}/squads/{args.squad}/activities",
            headers=headers, json=payload, timeout=20.0,
        )
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        return 1
    print(json.dumps(_handle(resp), indent=2, ensure_ascii=False, default=str))
    return 0


def cmd_update(args: argparse.Namespace) -> int:
    base, headers = _client()
    payload: dict[str, Any] = {}
    for src, dst in [
        ("name", "name"),
        ("display_name", "display_name"),
        ("skill_code", "skill_code"),
        ("target_count", "target_agent_count"),
        ("position", "position"),
        ("default_agent", "default_agent_id"),
        ("schedule", "schedule"),
    ]:
        v = getattr(args, src, None)
        if v is not None:
            payload[dst] = v
    if not payload:
        print("USAGE_ERROR: passe ao menos um campo pra atualizar", file=sys.stderr)
        return 2

    try:
        resp = httpx.patch(
            f"{base}/departments/{args.dept}/squads/{args.squad}/activities/{args.id}",
            headers=headers, json=payload, timeout=20.0,
        )
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        return 1
    print(json.dumps(_handle(resp), indent=2, ensure_ascii=False, default=str))
    return 0


def cmd_delete(args: argparse.Namespace) -> int:
    base, headers = _client()
    try:
        resp = httpx.delete(
            f"{base}/departments/{args.dept}/squads/{args.squad}/activities/{args.id}",
            headers=headers, timeout=20.0,
        )
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        return 1
    print(json.dumps(_handle(resp), indent=2, ensure_ascii=False, default=str))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Activities CRUD + schedule")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_create = sub.add_parser("create")
    p_create.add_argument("--dept", required=True)
    p_create.add_argument("--squad", required=True)
    p_create.add_argument("--name", required=True)
    p_create.add_argument("--display-name", required=True)
    p_create.add_argument("--skill-code", help="Código curto até 8 chars (ex: VAL)")
    p_create.add_argument("--target-count", type=int, help="Headcount alvo (default 1)")
    p_create.add_argument("--position", type=int)
    p_create.add_argument("--default-agent", help="UUID do digital employee default")
    p_create.add_argument("--schedule", help='Cron expression, ex: "*/15 * * * *"')

    p_update = sub.add_parser("update")
    p_update.add_argument("dept")
    p_update.add_argument("squad")
    p_update.add_argument("id", help="Activity UUID")
    p_update.add_argument("--name")
    p_update.add_argument("--display-name", dest="display_name")
    p_update.add_argument("--skill-code", dest="skill_code")
    p_update.add_argument("--target-count", dest="target_count", type=int)
    p_update.add_argument("--position", type=int)
    p_update.add_argument("--default-agent", dest="default_agent")
    p_update.add_argument("--schedule")

    p_delete = sub.add_parser("delete")
    p_delete.add_argument("dept")
    p_delete.add_argument("squad")
    p_delete.add_argument("id")

    args = parser.parse_args()
    return {"create": cmd_create, "update": cmd_update, "delete": cmd_delete}[args.cmd](args)


if __name__ == "__main__":
    sys.exit(main())
