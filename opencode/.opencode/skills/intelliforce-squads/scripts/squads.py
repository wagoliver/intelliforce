#!/usr/bin/env python3
"""squads.py — CRUD de squads (aninhado em /departments/{dept_id}/squads)."""
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
    payload: dict[str, Any] = {"name": args.name, "display_name": args.display_name}
    if args.position is not None:
        payload["position"] = args.position
    try:
        resp = httpx.post(
            f"{base}/departments/{args.dept}/squads",
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
    if args.display_name is not None:
        payload["display_name"] = args.display_name
    if args.position is not None:
        payload["position"] = args.position
    if not payload:
        print("USAGE_ERROR: passe ao menos um campo pra atualizar", file=sys.stderr)
        return 2
    try:
        resp = httpx.patch(
            f"{base}/departments/{args.dept}/squads/{args.id}",
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
            f"{base}/departments/{args.dept}/squads/{args.id}",
            headers=headers, timeout=20.0,
        )
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        return 1
    print(json.dumps(_handle(resp), indent=2, ensure_ascii=False, default=str))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Squads CRUD")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_create = sub.add_parser("create")
    p_create.add_argument("--dept", required=True, help="Department UUID")
    p_create.add_argument("--name", required=True)
    p_create.add_argument("--display-name", required=True)
    p_create.add_argument("--position", type=int)

    p_update = sub.add_parser("update")
    p_update.add_argument("dept", help="Department UUID")
    p_update.add_argument("id", help="Squad UUID")
    p_update.add_argument("--display-name")
    p_update.add_argument("--position", type=int)

    p_delete = sub.add_parser("delete")
    p_delete.add_argument("dept", help="Department UUID")
    p_delete.add_argument("id", help="Squad UUID")

    args = parser.parse_args()
    return {"create": cmd_create, "update": cmd_update, "delete": cmd_delete}[args.cmd](args)


if __name__ == "__main__":
    sys.exit(main())
