#!/usr/bin/env python3
"""tasks.py — disparar/listar/cancelar tasks."""
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
    try:
        return resp.json()
    except ValueError:
        return {"raw": resp.text}


def cmd_list(args: argparse.Namespace) -> int:
    base, headers = _client()
    params: dict[str, Any] = {"limit": args.limit}
    if args.agent:
        params["agent_id"] = args.agent
    if args.status:
        params["status_filter"] = args.status
    try:
        resp = httpx.get(f"{base}/tasks", headers=headers, params=params, timeout=20.0)
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        return 1
    print(json.dumps(_handle(resp), indent=2, ensure_ascii=False, default=str))
    return 0


def cmd_get(args: argparse.Namespace) -> int:
    base, headers = _client()
    try:
        resp = httpx.get(f"{base}/tasks/{args.id}", headers=headers, timeout=20.0)
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        return 1
    print(json.dumps(_handle(resp), indent=2, ensure_ascii=False, default=str))
    return 0


def cmd_create(args: argparse.Namespace) -> int:
    base, headers = _client()
    payload: dict[str, Any] = {"agent_id": args.agent}
    if args.prompt:
        payload["prompt"] = args.prompt
    if args.input:
        try:
            payload["input"] = json.loads(args.input)
        except json.JSONDecodeError as e:
            print(f"USAGE_ERROR: --input inválido: {e}", file=sys.stderr)
            return 2
    if args.correlation_id:
        payload["correlation_id"] = args.correlation_id
    if "input" not in payload and "prompt" not in payload:
        print("USAGE_ERROR: passe --prompt ou --input", file=sys.stderr)
        return 2
    if "prompt" not in payload:
        payload["prompt"] = ""

    try:
        resp = httpx.post(f"{base}/tasks", headers=headers, json=payload, timeout=20.0)
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        return 1
    print(json.dumps(_handle(resp), indent=2, ensure_ascii=False, default=str))
    return 0


def cmd_cancel(args: argparse.Namespace) -> int:
    base, headers = _client()
    payload = {"reason": args.reason or ""}
    try:
        resp = httpx.post(
            f"{base}/tasks/{args.id}/cancel",
            headers=headers, json=payload, timeout=20.0,
        )
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        return 1
    print(json.dumps(_handle(resp), indent=2, ensure_ascii=False, default=str))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Tasks CRUD")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_list = sub.add_parser("list")
    p_list.add_argument("--agent", help="Filtra por agent_id")
    p_list.add_argument("--status", help="Filtra por status (pending/running/...)")
    p_list.add_argument("--limit", type=int, default=50)

    p_get = sub.add_parser("get")
    p_get.add_argument("id")

    p_create = sub.add_parser("create")
    p_create.add_argument("--agent", required=True, help="Agent UUID")
    p_create.add_argument("--prompt", help="Prompt em texto")
    p_create.add_argument("--input", help="Input em JSON (string)")
    p_create.add_argument("--correlation-id", dest="correlation_id")

    p_cancel = sub.add_parser("cancel")
    p_cancel.add_argument("id")
    p_cancel.add_argument("--reason")

    args = parser.parse_args()
    return {
        "list": cmd_list, "get": cmd_get, "create": cmd_create, "cancel": cmd_cancel,
    }[args.cmd](args)


if __name__ == "__main__":
    sys.exit(main())
