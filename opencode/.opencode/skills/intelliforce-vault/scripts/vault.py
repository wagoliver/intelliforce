#!/usr/bin/env python3
"""vault.py — operações de leitura no Cofre IntelliForce.

Cadastro/edição/remoção de secrets é feito apenas pela UI `/vault`. Este
script só **lê**:

  list                 — metadata de todos os secrets (sem valores)
  get <slug> --skill   — valor descriptografado de um secret (em stdout)

Toda chamada ao endpoint `/secrets/<slug>/value` gera entrada no audit log
do backend, identificando quem (skill/user/task) acessou o quê.
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


def cmd_list(_: argparse.Namespace) -> int:
    base, headers = _client()
    try:
        resp = httpx.get(f"{base}/secrets", headers=headers, timeout=15.0)
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        return 1
    print(json.dumps(_handle(resp), indent=2, ensure_ascii=False, default=str))
    return 0


def cmd_get(args: argparse.Namespace) -> int:
    base, headers = _client()
    headers["X-Skill-Slug"] = args.skill
    if args.task_id:
        headers["X-Task-Id"] = args.task_id

    try:
        resp = httpx.get(
            f"{base}/secrets/{args.slug}/value",
            headers=headers,
            timeout=15.0,
        )
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        return 1

    if resp.status_code == 404:
        print(f"SECRET_NOT_FOUND: {args.slug}", file=sys.stderr)
        return 1

    data = _handle(resp)
    value = data.get("value") if isinstance(data, dict) else None
    if value is None:
        print("API_ERROR_NO_VALUE_FIELD", file=sys.stderr)
        return 1

    # stdout sem newline final pra `value=$(python vault.py get ...)` funcionar limpo
    sys.stdout.write(value)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Operações de leitura no Cofre IntelliForce.",
        epilog="Cadastro/edição/remoção é feito apenas pela UI /vault.",
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("list", help="Lista metadata de todos os secrets (sem valores).")

    p_get = sub.add_parser("get", help="Imprime o valor descriptografado em stdout.")
    p_get.add_argument("slug", help="Slug do secret (ex.: zoho-api-token)")
    p_get.add_argument(
        "--skill",
        required=True,
        help="Slug da skill que está acessando (vai pra audit log).",
    )
    p_get.add_argument(
        "--task-id",
        default=None,
        help="UUID da task em execução, se aplicável (opcional).",
    )

    args = parser.parse_args()
    if args.cmd == "list":
        return cmd_list(args)
    if args.cmd == "get":
        return cmd_get(args)
    parser.print_help()
    return 2


if __name__ == "__main__":
    sys.exit(main())
