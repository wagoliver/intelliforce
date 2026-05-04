#!/usr/bin/env python3
"""
discover.py — listagem read-only consolidada do estado do IntelliForce.

Faz chamadas paralelas (httpx async) pros endpoints de leitura e devolve um
JSON único pro operator processar. Argumentos:

  --only departments,agents,tasks   filtra áreas (default: todas)
  --limit N                          limite pra recent tasks (default: 10)

Saída: JSON em stdout. Erros categorizados em stderr (mesma convenção da
intelliforce-api SKILL.md).
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from typing import Any

import httpx

VALID_AREAS = {"departments", "agents", "tasks"}


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Discover IntelliForce state (read-only)")
    p.add_argument("--only", default="", help="Comma-separated: departments,agents,tasks")
    p.add_argument("--limit", type=int, default=10, help="Limit pra recent tasks (default 10)")
    return p.parse_args()


async def _fetch(client: httpx.AsyncClient, path: str) -> Any:
    resp = await client.get(path, timeout=15.0)
    if resp.status_code == 401:
        raise PermissionError("TOKEN_EXPIRED_OR_INVALID")
    if resp.status_code >= 400:
        raise RuntimeError(f"API_ERROR_{resp.status_code}: {resp.text[:200]}")
    return resp.json()


async def _gather(areas: set[str], limit: int) -> dict[str, Any]:
    token = os.environ.get("INTELLIFORCE_TOKEN", "").strip()
    base_url = os.environ.get("INTELLIFORCE_API_URL", "http://localhost:8000").rstrip("/")
    if not token:
        raise PermissionError("TOKEN_EMPTY")

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
    }

    out: dict[str, Any] = {}
    summary = {
        "departments_count": 0,
        "squads_count": 0,
        "activities_count": 0,
        "agents_count": 0,
        "recent_tasks_count": 0,
    }

    async with httpx.AsyncClient(base_url=base_url, headers=headers) as client:
        tasks: dict[str, Any] = {}
        if "departments" in areas:
            tasks["departments"] = _fetch(client, "/departments")
        if "agents" in areas:
            tasks["agents"] = _fetch(client, "/agents")
        if "tasks" in areas:
            tasks["recent_tasks"] = _fetch(client, f"/tasks?limit={limit}")

        results = await asyncio.gather(*tasks.values(), return_exceptions=True)
        for key, result in zip(tasks.keys(), results, strict=True):
            if isinstance(result, BaseException):
                raise result
            out[key] = result

    if "departments" in out:
        deps = out["departments"]
        summary["departments_count"] = len(deps)
        for d in deps:
            squads = d.get("squads") or []
            summary["squads_count"] += len(squads)
            for s in squads:
                summary["activities_count"] += len(s.get("activities") or [])

    if "agents" in out:
        summary["agents_count"] = len(out["agents"])

    if "recent_tasks" in out:
        summary["recent_tasks_count"] = len(out["recent_tasks"])

    out["summary"] = summary
    return out


def main() -> int:
    args = _parse_args()
    if args.only:
        areas = {a.strip() for a in args.only.split(",") if a.strip()}
        invalid = areas - VALID_AREAS
        if invalid:
            print(f"INVALID_AREA: {','.join(sorted(invalid))}", file=sys.stderr)
            return 2
    else:
        areas = set(VALID_AREAS)

    try:
        result = asyncio.run(_gather(areas, args.limit))
    except PermissionError as e:
        print(str(e), file=sys.stderr)
        return 1
    except httpx.TimeoutException:
        print("NETWORK_ERROR: timeout", file=sys.stderr)
        return 1
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        return 1
    except RuntimeError as e:
        print(str(e), file=sys.stderr)
        return 1

    print(json.dumps(result, indent=2, ensure_ascii=False, default=str))
    return 0


if __name__ == "__main__":
    sys.exit(main())
