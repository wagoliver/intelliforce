#!/usr/bin/env python3
"""reports.py — salvar/listar relatórios no Report Center."""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
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
    if resp.status_code >= 400:
        print(f"API_ERROR_{resp.status_code}: {resp.text[:200]}", file=sys.stderr)
        sys.exit(1)
    try:
        return resp.json()
    except ValueError:
        return {"raw": resp.text}


def cmd_create(args: argparse.Namespace) -> int:
    base, headers = _client()
    path = Path(args.content_file)
    if not path.exists():
        print(f"FILE_NOT_FOUND: {args.content_file}", file=sys.stderr)
        return 2
    content = path.read_text(encoding="utf-8")
    if not content.strip():
        print("USAGE_ERROR: arquivo de conteúdo vazio", file=sys.stderr)
        return 2

    payload: dict[str, Any] = {"title": args.title, "content": content}
    if args.summary:
        payload["summary"] = args.summary
    if args.department:
        payload["department_id"] = args.department
    if args.agent:
        payload["agent_id"] = args.agent
    if args.tags:
        payload["tags"] = [t.strip() for t in args.tags.split(",") if t.strip()]

    try:
        resp = httpx.post(f"{base}/reports", headers=headers, json=payload, timeout=30.0)
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        return 1
    print(json.dumps(_handle(resp), indent=2, ensure_ascii=False, default=str))
    return 0


def cmd_list(args: argparse.Namespace) -> int:
    base, headers = _client()
    params: dict[str, Any] = {"limit": args.limit}
    if args.department:
        params["department_id"] = args.department
    try:
        resp = httpx.get(f"{base}/reports", headers=headers, params=params, timeout=20.0)
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        return 1
    print(json.dumps(_handle(resp), indent=2, ensure_ascii=False, default=str))
    return 0


def cmd_get(args: argparse.Namespace) -> int:
    base, headers = _client()
    try:
        resp = httpx.get(f"{base}/reports/{args.id}", headers=headers, timeout=20.0)
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        return 1
    print(json.dumps(_handle(resp), indent=2, ensure_ascii=False, default=str))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Report Center")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_create = sub.add_parser("create", help="Salva um relatório (Markdown)")
    p_create.add_argument("--title", required=True)
    p_create.add_argument("--content-file", required=True, dest="content_file")
    p_create.add_argument("--summary")
    p_create.add_argument("--department")
    p_create.add_argument("--agent")
    p_create.add_argument("--tags", help="separadas por vírgula")

    p_list = sub.add_parser("list", help="Lista relatórios recentes")
    p_list.add_argument("--department")
    p_list.add_argument("--limit", type=int, default=50)

    p_get = sub.add_parser("get", help="Detalhe de um relatório (inclui o conteúdo)")
    p_get.add_argument("--id", required=True)

    args = parser.parse_args()
    return {"create": cmd_create, "list": cmd_list, "get": cmd_get}[args.cmd](args)


if __name__ == "__main__":
    sys.exit(main())
