#!/usr/bin/env python3
"""
get_secret.py — busca o valor descriptografado de um secret do Cofre.

Lê credenciais do env (INTELLIFORCE_TOKEN, INTELLIFORCE_API_URL) e chama
GET /secrets/{slug}/value. Cada chamada gera entrada no audit log da API,
identificando a skill que está acessando.

⚠️  IMPORTANTE: o valor sai em stdout. Em workflow com pipeline (ex.:
    `value=$(python get_secret.py zoho-api-token --skill foo)`), é seguro.
    NÃO escreva o valor em arquivo nem em log.

Uso:
  python get_secret.py <slug> --skill <nome-da-skill> [--task-id <uuid>]

Exemplos:
  python get_secret.py zoho-api-token --skill intelliforce-zoho-validador
  python get_secret.py db-password --skill intelliforce-postgres-checker --task-id abc-123

Saída:
  stdout: valor descriptografado (1 linha, sem newline final extra)
  stderr: SECRET_NOT_FOUND, TOKEN_EMPTY, TOKEN_EXPIRED_OR_INVALID, API_ERROR_<n>
  exit:   0 sucesso · 1 erro recuperável · 2 erro de uso (params)
"""
from __future__ import annotations

import argparse
import os
import sys

import httpx


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Busca valor de um secret do Cofre IntelliForce.",
        epilog="Cada chamada é registrada na auditoria.",
    )
    parser.add_argument("slug", help="Slug do secret (ex.: zoho-api-token)")
    parser.add_argument(
        "--skill",
        required=True,
        help="Slug da skill que está acessando (vai pra audit log).",
    )
    parser.add_argument(
        "--task-id",
        default=None,
        help="UUID da task em execução, se aplicável (opcional).",
    )
    args = parser.parse_args()

    token = os.environ.get("INTELLIFORCE_TOKEN", "").strip()
    base_url = os.environ.get("INTELLIFORCE_API_URL", "http://localhost:8000").rstrip("/")

    if not token:
        print("TOKEN_EMPTY", file=sys.stderr)
        return 1

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "X-Skill-Slug": args.skill,
    }
    if args.task_id:
        headers["X-Task-Id"] = args.task_id

    try:
        resp = httpx.get(
            f"{base_url}/secrets/{args.slug}/value",
            headers=headers,
            timeout=15.0,
        )
    except httpx.TimeoutException:
        print("NETWORK_ERROR: timeout", file=sys.stderr)
        return 1
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        return 1

    if resp.status_code == 401:
        print("TOKEN_EXPIRED_OR_INVALID", file=sys.stderr)
        return 1
    if resp.status_code == 404:
        print(f"SECRET_NOT_FOUND: {args.slug}", file=sys.stderr)
        return 1
    if resp.status_code >= 400:
        print(f"API_ERROR_{resp.status_code}: {resp.text[:200]}", file=sys.stderr)
        return 1

    try:
        data = resp.json()
    except ValueError:
        print(f"API_ERROR_INVALID_JSON: {resp.text[:200]}", file=sys.stderr)
        return 1

    value = data.get("value")
    if value is None:
        print("API_ERROR_NO_VALUE_FIELD", file=sys.stderr)
        return 1

    # stdout sem newline extra pra facilitar uso em $(...)
    sys.stdout.write(value)
    return 0


if __name__ == "__main__":
    sys.exit(main())
