#!/usr/bin/env python3
"""audit.py — events / llm-calls / task timeline (read-only)."""
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


def cmd_events(args: argparse.Namespace) -> int:
    base, headers = _client()
    params: dict[str, Any] = {"limit": args.limit}
    if args.type:
        params["event_type"] = args.type
    if args.aggregate_type:
        params["aggregate_type"] = args.aggregate_type
    if args.aggregate_id:
        params["aggregate_id"] = args.aggregate_id
    try:
        resp = httpx.get(f"{base}/audit/events", headers=headers, params=params, timeout=20.0)
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        return 1
    print(json.dumps(_handle(resp), indent=2, ensure_ascii=False, default=str))
    return 0


def cmd_llm_calls(args: argparse.Namespace) -> int:
    base, headers = _client()
    params: dict[str, Any] = {"limit": args.limit}
    if args.task_id:
        params["task_id"] = args.task_id
    try:
        resp = httpx.get(f"{base}/audit/llm-calls", headers=headers, params=params, timeout=20.0)
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        return 1
    print(json.dumps(_handle(resp), indent=2, ensure_ascii=False, default=str))
    return 0


def cmd_timeline(args: argparse.Namespace) -> int:
    base, headers = _client()
    try:
        resp = httpx.get(f"{base}/audit/tasks/{args.task_id}/timeline", headers=headers, timeout=20.0)
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        return 1
    print(json.dumps(_handle(resp), indent=2, ensure_ascii=False, default=str))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit read-only queries")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_events = sub.add_parser("events")
    p_events.add_argument("--type")
    p_events.add_argument("--aggregate-type", dest="aggregate_type")
    p_events.add_argument("--aggregate-id", dest="aggregate_id")
    p_events.add_argument("--limit", type=int, default=50)

    p_llm = sub.add_parser("llm-calls")
    p_llm.add_argument("--task-id", dest="task_id")
    p_llm.add_argument("--limit", type=int, default=100)

    p_tl = sub.add_parser("timeline")
    p_tl.add_argument("task_id")

    args = parser.parse_args()
    return {"events": cmd_events, "llm-calls": cmd_llm_calls, "timeline": cmd_timeline}[args.cmd](args)


if __name__ == "__main__":
    sys.exit(main())
