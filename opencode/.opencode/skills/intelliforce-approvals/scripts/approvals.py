#!/usr/bin/env python3
"""approvals.py — inbox + approve/reject de aprovações humanas."""
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


def cmd_inbox(args: argparse.Namespace) -> int:
    base, headers = _client()
    try:
        resp = httpx.get(f"{base}/approvals/inbox", headers=headers, timeout=20.0)
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        return 1
    print(json.dumps(_handle(resp), indent=2, ensure_ascii=False, default=str))
    return 0


def cmd_approve(args: argparse.Namespace) -> int:
    base, headers = _client()
    payload = {"reason": args.reason or ""}
    try:
        resp = httpx.post(
            f"{base}/approvals/{args.id}/approve",
            headers=headers, json=payload, timeout=20.0,
        )
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        return 1
    print(json.dumps(_handle(resp), indent=2, ensure_ascii=False, default=str))
    return 0


def cmd_reject(args: argparse.Namespace) -> int:
    base, headers = _client()
    payload = {"reason": args.reason or ""}
    try:
        resp = httpx.post(
            f"{base}/approvals/{args.id}/reject",
            headers=headers, json=payload, timeout=20.0,
        )
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        return 1
    print(json.dumps(_handle(resp), indent=2, ensure_ascii=False, default=str))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Approvals inbox + decisions")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("inbox")

    p_approve = sub.add_parser("approve")
    p_approve.add_argument("id")
    p_approve.add_argument("--reason")

    p_reject = sub.add_parser("reject")
    p_reject.add_argument("id")
    p_reject.add_argument("--reason")

    args = parser.parse_args()
    return {"inbox": cmd_inbox, "approve": cmd_approve, "reject": cmd_reject}[args.cmd](args)


if __name__ == "__main__":
    sys.exit(main())
