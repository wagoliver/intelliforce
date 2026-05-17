#!/usr/bin/env python3
"""
departments.py — CRUD de departamentos via API IntelliForce.

Subcomandos: list, get, create, update, delete.
Auth via env (INTELLIFORCE_TOKEN, INTELLIFORCE_API_URL — ver intelliforce-api SKILL.md).
"""
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


def _handle_resp(resp: httpx.Response) -> Any:
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


def cmd_list(args: argparse.Namespace) -> int:
    base, headers = _client()
    try:
        resp = httpx.get(f"{base}/departments", headers=headers, timeout=20.0)
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        return 1
    print(json.dumps(_handle_resp(resp), indent=2, ensure_ascii=False, default=str))
    return 0


def cmd_get(args: argparse.Namespace) -> int:
    base, headers = _client()
    try:
        resp = httpx.get(f"{base}/departments/{args.id}", headers=headers, timeout=20.0)
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        return 1
    print(json.dumps(_handle_resp(resp), indent=2, ensure_ascii=False, default=str))
    return 0


def cmd_create(args: argparse.Namespace) -> int:
    base, headers = _client()
    payload: dict[str, Any] = {
        "name": args.name,
        "display_name": args.display_name,
    }
    if args.objective is not None:
        payload["objective"] = args.objective
    if args.budget is not None:
        payload["monthly_cost_budget_usd"] = args.budget
    if args.health:
        payload["health"] = args.health

    try:
        resp = httpx.post(f"{base}/departments", headers=headers, json=payload, timeout=20.0)
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        return 1
    print(json.dumps(_handle_resp(resp), indent=2, ensure_ascii=False, default=str))
    return 0


def cmd_update(args: argparse.Namespace) -> int:
    base, headers = _client()
    payload: dict[str, Any] = {}
    if args.display_name is not None:
        payload["display_name"] = args.display_name
    if args.objective is not None:
        payload["objective"] = args.objective
    if args.budget is not None:
        payload["monthly_cost_budget_usd"] = args.budget
    if args.health:
        payload["health"] = args.health
    if not payload:
        print("USAGE_ERROR: passe ao menos um campo pra atualizar", file=sys.stderr)
        return 2

    try:
        resp = httpx.patch(f"{base}/departments/{args.id}", headers=headers, json=payload, timeout=20.0)
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        return 1
    print(json.dumps(_handle_resp(resp), indent=2, ensure_ascii=False, default=str))
    return 0


def cmd_delete(args: argparse.Namespace) -> int:
    base, headers = _client()
    try:
        resp = httpx.delete(f"{base}/departments/{args.id}", headers=headers, timeout=20.0)
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        return 1
    print(json.dumps(_handle_resp(resp), indent=2, ensure_ascii=False, default=str))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Departments CRUD")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("list")

    p_get = sub.add_parser("get")
    p_get.add_argument("id")

    p_create = sub.add_parser("create")
    p_create.add_argument("--name", required=True, help="Slug kebab-case")
    p_create.add_argument("--display-name", required=True)
    p_create.add_argument("--objective")
    p_create.add_argument("--budget", help="Decimal monthly_cost_budget_usd")
    p_create.add_argument("--health", choices=["healthy", "attention"])

    p_update = sub.add_parser("update")
    p_update.add_argument("id")
    p_update.add_argument("--display-name")
    p_update.add_argument("--objective")
    p_update.add_argument("--budget")
    p_update.add_argument("--health", choices=["healthy", "attention"])

    p_delete = sub.add_parser("delete")
    p_delete.add_argument("id")

    args = parser.parse_args()
    handlers = {
        "list": cmd_list,
        "get": cmd_get,
        "create": cmd_create,
        "update": cmd_update,
        "delete": cmd_delete,
    }
    return handlers[args.cmd](args)


if __name__ == "__main__":
    sys.exit(main())
