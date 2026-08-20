#!/usr/bin/env python3
"""agents.py — CRUD de agent definitions (digital employees)."""
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


def _parse_skills(raw: str | None) -> list[str] | None:
    if raw is None:
        return None
    return [s.strip() for s in raw.split(",") if s.strip()]


def _parse_bool(v: str | None) -> bool | None:
    if v is None:
        return None
    if v.lower() in ("true", "1", "yes", "y"):
        return True
    if v.lower() in ("false", "0", "no", "n"):
        return False
    raise ValueError(f"valor booleano inválido: {v}")


def cmd_list(args: argparse.Namespace) -> int:
    base, headers = _client()
    try:
        resp = httpx.get(f"{base}/agents", headers=headers, timeout=20.0)
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        return 1
    print(json.dumps(_handle(resp), indent=2, ensure_ascii=False, default=str))
    return 0


def cmd_get(args: argparse.Namespace) -> int:
    base, headers = _client()
    try:
        resp = httpx.get(f"{base}/agents/{args.id}", headers=headers, timeout=20.0)
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        return 1
    print(json.dumps(_handle(resp), indent=2, ensure_ascii=False, default=str))
    return 0


def cmd_create(args: argparse.Namespace) -> int:
    base, headers = _client()
    payload: dict[str, Any] = {
        "name": args.name,
        "display_name": args.display_name,
        "opencode_agent_file": args.opencode_agent_file,
    }
    if args.description is not None:
        payload["description"] = args.description
    skills = _parse_skills(args.skills)
    if skills is not None:
        payload["skills"] = skills
    if args.schedule is not None:
        payload["schedule"] = args.schedule
    if args.manager_user_id is not None:
        payload["manager_user_id"] = args.manager_user_id

    try:
        resp = httpx.post(f"{base}/agents", headers=headers, json=payload, timeout=20.0)
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
    if args.description is not None:
        payload["description"] = args.description
    if args.opencode_agent_file is not None:
        payload["opencode_agent_file"] = args.opencode_agent_file
    skills = _parse_skills(args.skills)
    if skills is not None:
        payload["skills"] = skills
    if args.schedule is not None:
        payload["schedule"] = args.schedule
    try:
        is_active = _parse_bool(args.is_active)
    except ValueError as e:
        print(f"USAGE_ERROR: {e}", file=sys.stderr)
        return 2
    if is_active is not None:
        payload["is_active"] = is_active
    if args.manager_user_id is not None:
        payload["manager_user_id"] = args.manager_user_id

    if not payload:
        print("USAGE_ERROR: passe ao menos um campo pra atualizar", file=sys.stderr)
        return 2

    try:
        resp = httpx.patch(f"{base}/agents/{args.id}", headers=headers, json=payload, timeout=20.0)
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        return 1
    print(json.dumps(_handle(resp), indent=2, ensure_ascii=False, default=str))
    return 0


def cmd_delete(args: argparse.Namespace) -> int:
    base, headers = _client()
    try:
        resp = httpx.delete(f"{base}/agents/{args.id}", headers=headers, timeout=20.0)
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        return 1
    print(json.dumps(_handle(resp), indent=2, ensure_ascii=False, default=str))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Agents CRUD")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("list")

    p_get = sub.add_parser("get")
    p_get.add_argument("id")

    p_create = sub.add_parser("create")
    p_create.add_argument("--name", required=True)
    p_create.add_argument("--display-name", required=True)
    p_create.add_argument("--opencode-agent-file", required=True,
                          help="Path .md dentro de opencode/.opencode/, ex: agents/validador.md")
    p_create.add_argument("--model", help="DEPRECADO e ignorado — modelo vem do .env")
    p_create.add_argument("--description")
    p_create.add_argument("--skills", help="Comma-separated lista de slugs de skills")
    p_create.add_argument("--schedule")
    p_create.add_argument("--manager-user-id", dest="manager_user_id")

    p_update = sub.add_parser("update")
    p_update.add_argument("id")
    p_update.add_argument("--display-name", dest="display_name")
    p_update.add_argument("--description")
    p_update.add_argument("--opencode-agent-file", dest="opencode_agent_file")
    p_update.add_argument("--model", help="DEPRECADO e ignorado — modelo vem do .env")
    p_update.add_argument("--skills")
    p_update.add_argument("--schedule")
    p_update.add_argument("--is-active", dest="is_active", help="true|false")
    p_update.add_argument("--manager-user-id", dest="manager_user_id")

    p_delete = sub.add_parser("delete")
    p_delete.add_argument("id")

    args = parser.parse_args()
    return {
        "list": cmd_list,
        "get": cmd_get,
        "create": cmd_create,
        "update": cmd_update,
        "delete": cmd_delete,
    }[args.cmd](args)


if __name__ == "__main__":
    sys.exit(main())
