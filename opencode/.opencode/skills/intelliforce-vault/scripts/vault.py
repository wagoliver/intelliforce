#!/usr/bin/env python3
"""vault.py — operações de leitura no Cofre IntelliForce.

Cadastro/edição/remoção de secrets é feito apenas pela UI `/vault`. Este
script só **lê**:

  list                          — metadata de todos os secrets (sem valores)
  get <slug> --skill X --field K  → 1 campo específico (audit registra K)
  get <slug> --skill X --all      → todos os campos como JSON
  get <slug> --skill X            → atalho: se secret tem 1 só campo,
                                    retorna o valor cru. Multi-field
                                    sem flag dá erro pedindo --field/--all.

Toda chamada gera entrada no audit log do backend.
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


def _http_get(url: str, headers: dict[str, str]) -> Any:
    try:
        resp = httpx.get(url, headers=headers, timeout=15.0)
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        sys.exit(1)
    return _handle(resp)


def cmd_get(args: argparse.Namespace) -> int:
    base, headers = _client()
    headers["X-Skill-Slug"] = args.skill
    if args.task_id:
        headers["X-Task-Id"] = args.task_id

    # Modo "all-fields": pega todos como JSON
    if args.all_fields:
        url = f"{base}/secrets/{args.slug}/values"
        data = _http_get(url, headers)
        fields = data.get("fields") if isinstance(data, dict) else None
        if not isinstance(fields, dict):
            print("API_ERROR_INVALID_RESPONSE", file=sys.stderr)
            return 1
        # JSON-only: stdout deterministico (sem indent pra não inflar logs)
        sys.stdout.write(json.dumps(fields, ensure_ascii=False))
        return 0

    # Modo "single field" explícito
    if args.field:
        url = f"{base}/secrets/{args.slug}/value?field={args.field}"
        data = _http_get(url, headers)
        value = data.get("value") if isinstance(data, dict) else None
        if value is None:
            print("API_ERROR_NO_VALUE_FIELD", file=sys.stderr)
            return 1
        sys.stdout.write(value)
        return 0

    # Sem --field nem --all-fields: tenta heurística "secret de campo único".
    # Lista metadata pra ver quantos campos tem; se 1 só, busca esse campo.
    list_data = _http_get(f"{base}/secrets", headers)
    if not isinstance(list_data, list):
        print("API_ERROR_INVALID_LIST", file=sys.stderr)
        return 1
    target = next((s for s in list_data if isinstance(s, dict) and s.get("slug") == args.slug), None)
    if target is None:
        print(f"SECRET_NOT_FOUND: {args.slug}", file=sys.stderr)
        return 1

    field_keys = target.get("field_keys") or []
    if len(field_keys) == 0:
        print(f"SECRET_HAS_NO_FIELDS: {args.slug}", file=sys.stderr)
        return 1
    if len(field_keys) > 1:
        keys_str = ", ".join(field_keys)
        print(
            f"AMBIGUOUS_FIELDS: '{args.slug}' tem {len(field_keys)} campos "
            f"({keys_str}). Use --field <nome> ou --all-fields.",
            file=sys.stderr,
        )
        return 2

    only_key = field_keys[0]
    url = f"{base}/secrets/{args.slug}/value?field={only_key}"
    data = _http_get(url, headers)
    value = data.get("value") if isinstance(data, dict) else None
    if value is None:
        print("API_ERROR_NO_VALUE_FIELD", file=sys.stderr)
        return 1
    sys.stdout.write(value)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Operações de leitura no Cofre IntelliForce.",
        epilog="Cadastro/edição/remoção é feito apenas pela UI /vault.",
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("list", help="Lista metadata de todos os secrets (sem valores).")

    p_get = sub.add_parser(
        "get",
        help="Imprime o valor de 1 campo (ou JSON com todos com --all-fields).",
    )
    p_get.add_argument("slug", help="Slug do secret (ex.: zoho)")
    p_get.add_argument(
        "--skill",
        required=True,
        help="Slug da skill que está acessando (vai pra audit log).",
    )
    p_get.add_argument(
        "--field",
        default=None,
        help="Nome do campo específico (ex.: client_id). Mutuamente exclusivo com --all-fields.",
    )
    p_get.add_argument(
        "--all-fields",
        action="store_true",
        help="Retorna todos os campos como JSON `{key: value, ...}` em stdout.",
    )
    p_get.add_argument(
        "--task-id",
        default=None,
        help="UUID da task em execução, se aplicável (opcional).",
    )

    args = parser.parse_args()

    if args.cmd == "get":
        if args.field and args.all_fields:
            print("USAGE_ERROR: --field e --all-fields são mutuamente exclusivos", file=sys.stderr)
            return 2
        return cmd_get(args)
    if args.cmd == "list":
        return cmd_list(args)
    parser.print_help()
    return 2


if __name__ == "__main__":
    sys.exit(main())
