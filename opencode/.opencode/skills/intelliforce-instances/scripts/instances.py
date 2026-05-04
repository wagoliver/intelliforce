#!/usr/bin/env python3
"""instances.py — scale + list de AgentInstances por activity."""
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
        return {"ok": True}
    try:
        return resp.json()
    except ValueError:
        return {"raw": resp.text}


def cmd_list(args: argparse.Namespace) -> int:
    base, headers = _client()
    try:
        resp = httpx.get(
            f"{base}/activities/{args.activity_id}/instances",
            headers=headers, timeout=20.0,
        )
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        return 1
    print(json.dumps(_handle(resp), indent=2, ensure_ascii=False, default=str))
    return 0


def cmd_scale(args: argparse.Namespace) -> int:
    base, headers = _client()
    payload: dict[str, Any] = {"target_count": args.target}
    if args.agent is not None:
        payload["agent_id"] = args.agent

    try:
        resp = httpx.post(
            f"{base}/activities/{args.activity_id}/scale",
            headers=headers, json=payload, timeout=30.0,
        )
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        return 1
    print(json.dumps(_handle(resp), indent=2, ensure_ascii=False, default=str))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="AgentInstances scale + list")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_list = sub.add_parser("list")
    p_list.add_argument("activity_id")

    p_scale = sub.add_parser("scale")
    p_scale.add_argument("activity_id")
    p_scale.add_argument("--target", type=int, required=True, help="Headcount alvo (0-10000)")
    p_scale.add_argument("--agent", help="UUID do agent (definição). Obrigatório se activity sem default_agent_id e target>0")

    args = parser.parse_args()
    return {"list": cmd_list, "scale": cmd_scale}[args.cmd](args)


if __name__ == "__main__":
    sys.exit(main())
