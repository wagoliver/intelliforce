#!/usr/bin/env python3
"""
auth_check.py — sanity check de autenticação contra a API IntelliForce.

Lê credenciais do env (INTELLIFORCE_TOKEN, INTELLIFORCE_API_URL), chama
GET /auth/me e imprime o JSON da resposta. Padrão de erro/exit code documentado
em intelliforce-api/SKILL.md.

Uso:
  python auth_check.py
"""
from __future__ import annotations

import json
import os
import sys

import httpx


def main() -> int:
    token = os.environ.get("INTELLIFORCE_TOKEN", "").strip()
    base_url = os.environ.get("INTELLIFORCE_API_URL", "http://localhost:8000").rstrip("/")

    if not token:
        print("TOKEN_EMPTY", file=sys.stderr)
        return 1

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
    }

    try:
        resp = httpx.get(f"{base_url}/auth/me", headers=headers, timeout=15.0)
    except httpx.TimeoutException:
        print("NETWORK_ERROR: timeout", file=sys.stderr)
        return 1
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        return 1

    if resp.status_code == 401:
        print("TOKEN_EXPIRED_OR_INVALID", file=sys.stderr)
        return 1
    if resp.status_code >= 500:
        print(f"API_ERROR_{resp.status_code}: {resp.text[:200]}", file=sys.stderr)
        return 1
    if resp.status_code >= 400:
        print(f"API_ERROR_{resp.status_code}: {resp.text[:200]}", file=sys.stderr)
        return 1

    try:
        data = resp.json()
    except ValueError:
        print(f"API_ERROR_INVALID_JSON: {resp.text[:200]}", file=sys.stderr)
        return 1

    print(json.dumps(data, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
