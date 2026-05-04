#!/usr/bin/env python3
"""metrics.py — métricas read-only (custos, history, performance)."""
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


def cmd_department(args: argparse.Namespace) -> int:
    base, headers = _client()
    try:
        resp = httpx.get(f"{base}/metrics/department/{args.id}", headers=headers, timeout=20.0)
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        return 1
    print(json.dumps(_handle(resp), indent=2, ensure_ascii=False, default=str))
    return 0


def cmd_history(args: argparse.Namespace) -> int:
    base, headers = _client()
    try:
        resp = httpx.get(
            f"{base}/metrics/department/{args.id}/history",
            headers=headers, params={"limit": args.limit}, timeout=20.0,
        )
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        return 1
    print(json.dumps(_handle(resp), indent=2, ensure_ascii=False, default=str))
    return 0


def cmd_cost(args: argparse.Namespace) -> int:
    base, headers = _client()
    try:
        resp = httpx.get(
            f"{base}/metrics/cost-summary",
            headers=headers, params={"period_days": args.days}, timeout=20.0,
        )
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        return 1
    print(json.dumps(_handle(resp), indent=2, ensure_ascii=False, default=str))
    return 0


def cmd_activity_recent(args: argparse.Namespace) -> int:
    base, headers = _client()
    try:
        resp = httpx.get(
            f"{base}/metrics/activity/{args.id}/recent",
            headers=headers, params={"limit": args.limit}, timeout=20.0,
        )
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        return 1
    print(json.dumps(_handle(resp), indent=2, ensure_ascii=False, default=str))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Metrics read-only")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_dept = sub.add_parser("department")
    p_dept.add_argument("id")

    p_hist = sub.add_parser("history")
    p_hist.add_argument("id", help="Department UUID")
    p_hist.add_argument("--limit", type=int, default=20)

    p_cost = sub.add_parser("cost")
    p_cost.add_argument("--days", type=int, default=30)

    p_act = sub.add_parser("activity-recent")
    p_act.add_argument("id", help="Activity UUID")
    p_act.add_argument("--limit", type=int, default=10)

    args = parser.parse_args()
    return {
        "department": cmd_department,
        "history": cmd_history,
        "cost": cmd_cost,
        "activity-recent": cmd_activity_recent,
    }[args.cmd](args)


if __name__ == "__main__":
    sys.exit(main())
