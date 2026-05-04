#!/usr/bin/env python3
"""teams.py — Microsoft Teams via 2 caminhos: Power Automate webhook OU Graph API.

Webhook (default, simples, one-way):
  - Vault slug: teams-webhook-<channel>  campo: url
  - Auth: SAS token na URL (sig=...)
  - Operações: send, send-card

Graph API (avançado, bidirecional):
  - Vault slug: microsoft-teams  campos: client_id, client_secret, tenant_id
  - Auth: Azure AD client_credentials
  - Operações: send, send-card (com mention real), listen, list-teams,
              list-channels, resolve
  - Requer: Teams App package + RSC instalado no team
            (ver tools/teams-app-package/)

Convenção de output:
  - stdout: JSON
  - stderr: erros categóricos
  - exit:   0 sucesso · 1 runtime · 2 uso · 3 timeout (listen)
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx

VAULT_SCRIPT = "/opencode-runtime/.opencode/skills/intelliforce-vault/scripts/vault.py"

# Vault slugs
DEFAULT_WEBHOOK_SLUG = "teams-webhook-digital-employee"
DEFAULT_GRAPH_SLUG = "microsoft-teams"

# Graph endpoints
GRAPH_BASE = "https://graph.microsoft.com/v1.0"
TOKEN_URL = "https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"


# ═════════════════════════════════════════════════════════════════════════════
# Vault helpers
# ═════════════════════════════════════════════════════════════════════════════
def _vault_get_field(slug: str, field: str, skill: str) -> str:
    r = subprocess.run(
        ["python", VAULT_SCRIPT, "get", slug, "--skill", skill, "--field", field],
        capture_output=True, text=True, timeout=20,
    )
    if r.returncode != 0:
        err = r.stderr.strip()
        if "SECRET_NOT_FOUND" in err:
            print(f"VAULT_MISSING: cadastre '{slug}' em /vault", file=sys.stderr)
        elif "API_ERROR_404" in err and "Campo" in err:
            print(f"VAULT_FIELD_MISSING: '{slug}' sem campo `{field}`", file=sys.stderr)
        else:
            print(f"VAULT_ERROR: {err}", file=sys.stderr)
        sys.exit(1)
    return r.stdout.strip()


def _vault_get_all(slug: str, skill: str) -> dict[str, str]:
    r = subprocess.run(
        ["python", VAULT_SCRIPT, "get", slug, "--skill", skill, "--all-fields"],
        capture_output=True, text=True, timeout=20,
    )
    if r.returncode != 0:
        err = r.stderr.strip()
        if "SECRET_NOT_FOUND" in err:
            print(
                f"VAULT_MISSING: cadastre '{slug}' em /vault com 3 campos "
                "(client_id, client_secret, tenant_id)",
                file=sys.stderr,
            )
        else:
            print(f"VAULT_ERROR: {err}", file=sys.stderr)
        sys.exit(1)
    try:
        return json.loads(r.stdout)
    except json.JSONDecodeError:
        print("VAULT_INVALID_JSON", file=sys.stderr)
        sys.exit(1)


def _get_webhook_url(slug: str, skill: str) -> str:
    url = _vault_get_field(slug, "url", skill)
    if not url:
        print(f"VAULT_FIELD_EMPTY: '{slug}' campo `url` vazio", file=sys.stderr)
        sys.exit(1)
    return url


def _get_graph_credentials(slug: str, skill: str) -> dict[str, str]:
    creds = _vault_get_all(slug, skill)
    required = {"client_id", "client_secret", "tenant_id"}
    missing = required - set(creds.keys())
    if missing:
        print(
            f"VAULT_MISSING_FIELDS: '{slug}' está sem {', '.join(sorted(missing))}",
            file=sys.stderr,
        )
        sys.exit(1)
    return creds


# ═════════════════════════════════════════════════════════════════════════════
# Adaptive Card builder
# ═════════════════════════════════════════════════════════════════════════════
def _build_simple_card(
    *, message: str, subject: str | None = None, footer: str | None = None
) -> dict:
    """Adaptive Card mínimo: subject (bold) + message (wrap) + footer (subtle)."""
    body: list[dict] = []
    if subject:
        body.append({
            "type": "TextBlock", "text": subject,
            "weight": "bolder", "size": "medium", "wrap": True,
        })
    body.append({"type": "TextBlock", "text": message, "wrap": True})
    auto_footer = footer or (
        "via IntelliForce · "
        + datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    )
    body.append({
        "type": "TextBlock", "text": auto_footer,
        "size": "small", "isSubtle": True,
        "spacing": "small", "wrap": True,
    })
    return {
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "type": "AdaptiveCard", "version": "1.4", "body": body,
    }


def _load_card_from_args(args: argparse.Namespace) -> dict:
    if args.card_file:
        path = Path(args.card_file)
        if not path.is_file():
            print(f"CARD_FILE_NOT_FOUND: {path}", file=sys.stderr)
            sys.exit(2)
        raw = path.read_text(encoding="utf-8")
    elif args.card_json:
        raw = args.card_json
    elif not sys.stdin.isatty():
        raw = sys.stdin.read()
    else:
        print("CARD_INPUT_MISSING: --card-file, --card-json ou pipe stdin", file=sys.stderr)
        sys.exit(2)

    try:
        card = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"CARD_INVALID_JSON: {e}", file=sys.stderr)
        sys.exit(2)

    if isinstance(card, dict) and "content" in card and "contentType" in card:
        card = card["content"]

    if not isinstance(card, dict) or card.get("type") != "AdaptiveCard":
        print(
            "CARD_INVALID_SHAPE: raiz precisa ter \"type\": \"AdaptiveCard\". "
            "Não use wrapper {contentType, content}.",
            file=sys.stderr,
        )
        sys.exit(2)
    return card


# ═════════════════════════════════════════════════════════════════════════════
# Webhook (Power Automate)
# ═════════════════════════════════════════════════════════════════════════════
def _post_webhook(url: str, card: dict) -> int:
    try:
        r = httpx.post(url, json=card, timeout=20.0)
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        return 1

    if r.status_code in (200, 202, 204):
        print(json.dumps({
            "ok": True, "via": "webhook", "status": r.status_code,
            "sent_at": datetime.now(timezone.utc).isoformat(),
        }, ensure_ascii=False))
        return 0

    body = r.text[:400] if r.text else "(empty)"
    if r.status_code in (401, 403):
        print(
            f"WEBHOOK_UNAUTHORIZED ({r.status_code}): URL inválida ou expirada. "
            f"Re-gere no Power Automate e atualize Vault. Body: {body}",
            file=sys.stderr,
        )
    elif r.status_code == 404:
        print(f"WEBHOOK_NOT_FOUND (404): flow deletado. Body: {body}", file=sys.stderr)
    elif r.status_code == 400:
        print(
            f"WEBHOOK_BAD_REQUEST (400): card inválido. Body: {body}",
            file=sys.stderr,
        )
    else:
        print(f"WEBHOOK_ERROR_{r.status_code}: {body}", file=sys.stderr)
    return 1


# ═════════════════════════════════════════════════════════════════════════════
# Graph API (Microsoft Graph)
# ═════════════════════════════════════════════════════════════════════════════
def _get_access_token(creds: dict[str, str]) -> str:
    url = TOKEN_URL.format(tenant_id=creds["tenant_id"])
    data = {
        "grant_type": "client_credentials",
        "client_id": creds["client_id"],
        "client_secret": creds["client_secret"],
        "scope": "https://graph.microsoft.com/.default",
    }
    try:
        r = httpx.post(url, data=data, timeout=15.0)
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        sys.exit(1)
    if r.status_code != 200:
        try:
            err = r.json()
            print(
                f"AUTH_ERROR_{r.status_code}: {err.get('error', '?')} — "
                f"{(err.get('error_description') or '')[:300]}",
                file=sys.stderr,
            )
        except Exception:
            print(f"AUTH_ERROR_{r.status_code}: {r.text[:300]}", file=sys.stderr)
        sys.exit(1)
    return r.json()["access_token"]


def _graph(method: str, path: str, token: str, *, json_body=None, params=None):
    url = f"{GRAPH_BASE}{path}"
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    if json_body is not None:
        headers["Content-Type"] = "application/json"
    try:
        r = httpx.request(method, url, headers=headers, json=json_body, params=params, timeout=20.0)
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        sys.exit(1)

    if r.status_code == 401:
        print("TOKEN_REJECTED: access_token inválido/expirado", file=sys.stderr)
        sys.exit(1)
    if r.status_code == 403:
        try:
            err = r.json().get("error", {})
            msg = err.get("message", r.text[:300])
            code = err.get("code", "")
            print(f"PERMISSION_DENIED ({code}): {msg}", file=sys.stderr)
        except Exception:
            print(f"PERMISSION_DENIED: {r.text[:300]}", file=sys.stderr)
        print(
            "→ Pra `send` em channel, app precisa de RSC instalado no team. "
            "Ver tools/teams-app-package/.",
            file=sys.stderr,
        )
        sys.exit(1)
    if r.status_code == 404:
        try:
            msg = r.json().get("error", {}).get("message", r.text[:200])
        except Exception:
            msg = r.text[:200]
        print(f"NOT_FOUND: {msg}", file=sys.stderr)
        sys.exit(1)
    if r.status_code >= 400:
        try:
            msg = r.json().get("error", {}).get("message", r.text[:300])
        except Exception:
            msg = r.text[:300]
        print(f"API_ERROR_{r.status_code}: {msg}", file=sys.stderr)
        sys.exit(1)

    if r.status_code == 204 or not r.content:
        return None
    try:
        return r.json()
    except json.JSONDecodeError:
        return {"raw": r.text}


def _looks_like_uuid(s: str) -> bool:
    return len(s) == 36 and s.count("-") == 4


def _resolve_team_id(token: str, name_or_id: str) -> str:
    if _looks_like_uuid(name_or_id):
        return name_or_id
    data = _graph(
        "GET", "/teams", token,
        params={"$top": 100, "$select": "id,displayName"},
    )
    for t in (data or {}).get("value", []):
        if t.get("displayName", "").strip().lower() == name_or_id.strip().lower():
            return t["id"]
    avail = [t.get("displayName") for t in (data or {}).get("value", [])]
    print(f"TEAM_NOT_FOUND: '{name_or_id}'. Disponíveis: {avail}", file=sys.stderr)
    sys.exit(1)


def _resolve_channel_id(token: str, team_id: str, name_or_id: str) -> str:
    if name_or_id.startswith("19:"):
        return name_or_id
    data = _graph("GET", f"/teams/{team_id}/channels", token)
    for c in (data or {}).get("value", []):
        if c.get("displayName", "").strip().lower() == name_or_id.strip().lower():
            return c["id"]
    avail = [c.get("displayName") for c in (data or {}).get("value", [])]
    print(f"CHANNEL_NOT_FOUND: '{name_or_id}'. Disponíveis: {avail}", file=sys.stderr)
    sys.exit(1)


def _post_graph_message(
    token: str, team_id: str, channel_id: str,
    *, content: str, content_type: str = "html",
    mentions: list[dict] | None = None, subject: str | None = None,
) -> dict:
    body = {"body": {"content": content, "contentType": content_type}}
    if mentions:
        body["mentions"] = mentions
    if subject:
        body["subject"] = subject
    return _graph(
        "POST",
        f"/teams/{team_id}/channels/{channel_id}/messages",
        token,
        json_body=body,
    ) or {}


def _build_mention(token: str, upn: str, content: str) -> tuple[str, list[dict]]:
    """Resolve UPN → user object e injeta `<at>` no início do content."""
    user = _graph("GET", f"/users/{upn}", token) or {}
    display = user.get("displayName") or upn
    new_content = f'<at id="0">{display}</at> {content}'
    mentions = [{
        "id": 0, "mentionText": display,
        "mentioned": {
            "user": {
                "id": user.get("id", ""),
                "displayName": display,
                "userIdentityType": "aadUser",
            }
        },
    }]
    return new_content, mentions


# ═════════════════════════════════════════════════════════════════════════════
# Comandos
# ═════════════════════════════════════════════════════════════════════════════
def cmd_send(args: argparse.Namespace) -> int:
    if args.via == "webhook":
        if args.mention:
            print(
                "MENTION_NOT_SUPPORTED_VIA_WEBHOOK: --mention requer --via graph",
                file=sys.stderr,
            )
            return 2
        url = _get_webhook_url(args.webhook_secret, args.skill)
        card = _build_simple_card(
            message=args.message, subject=args.subject, footer=args.footer,
        )
        return _post_webhook(url, card)

    # via graph
    if not args.team or not args.channel:
        print(
            "GRAPH_REQUIRES_TEAM_AND_CHANNEL: --via graph exige --team e --channel",
            file=sys.stderr,
        )
        return 2
    creds = _get_graph_credentials(args.graph_secret, args.skill)
    token = _get_access_token(creds)
    team_id = _resolve_team_id(token, args.team)
    channel_id = _resolve_channel_id(token, team_id, args.channel)

    content = args.message
    mentions: list[dict] | None = None
    if args.mention:
        content, mentions = _build_mention(token, args.mention, content)

    result = _post_graph_message(
        token, team_id, channel_id,
        content=content,
        content_type="html" if (args.mention or args.html) else "text",
        mentions=mentions, subject=args.subject,
    )
    print(json.dumps({
        "ok": True, "via": "graph",
        "id": result.get("id"),
        "createdDateTime": result.get("createdDateTime"),
        "webUrl": result.get("webUrl"),
        "team_id": team_id, "channel_id": channel_id,
    }, indent=2, ensure_ascii=False))
    return 0


def cmd_send_card(args: argparse.Namespace) -> int:
    card = _load_card_from_args(args)
    if args.via == "webhook":
        url = _get_webhook_url(args.webhook_secret, args.skill)
        return _post_webhook(url, card)

    # via graph: encapsula como Adaptive Card attachment
    if not args.team or not args.channel:
        print("GRAPH_REQUIRES_TEAM_AND_CHANNEL", file=sys.stderr)
        return 2
    creds = _get_graph_credentials(args.graph_secret, args.skill)
    token = _get_access_token(creds)
    team_id = _resolve_team_id(token, args.team)
    channel_id = _resolve_channel_id(token, team_id, args.channel)

    attachment_id = "1"
    body = {
        "body": {
            "contentType": "html",
            "content": f'<attachment id="{attachment_id}"></attachment>',
        },
        "attachments": [{
            "id": attachment_id,
            "contentType": "application/vnd.microsoft.card.adaptive",
            "content": json.dumps(card),
        }],
    }
    result = _graph(
        "POST", f"/teams/{team_id}/channels/{channel_id}/messages",
        token, json_body=body,
    ) or {}
    print(json.dumps({
        "ok": True, "via": "graph",
        "id": result.get("id"),
        "createdDateTime": result.get("createdDateTime"),
        "webUrl": result.get("webUrl"),
    }, indent=2, ensure_ascii=False))
    return 0


def cmd_listen(args: argparse.Namespace) -> int:
    """Polla mensagens novas até a 1ª aparecer ou timeout. Graph only."""
    creds = _get_graph_credentials(args.graph_secret, args.skill)
    token = _get_access_token(creds)
    team_id = _resolve_team_id(token, args.team)
    channel_id = _resolve_channel_id(token, team_id, args.channel)

    since_dt = (
        datetime.fromisoformat(args.since.replace("Z", "+00:00"))
        if args.since else datetime.now(timezone.utc)
    )
    deadline = time.monotonic() + args.timeout
    seen: set[str] = set()

    while time.monotonic() < deadline:
        data = _graph(
            "GET", f"/teams/{team_id}/channels/{channel_id}/messages",
            token, params={"$top": 20},
        )
        new_msgs = []
        for msg in (data or {}).get("value", []):
            mid = msg.get("id")
            if not mid or mid in seen:
                continue
            try:
                created = datetime.fromisoformat(
                    msg.get("createdDateTime", "").replace("Z", "+00:00")
                )
            except (ValueError, AttributeError):
                continue
            if created <= since_dt:
                continue
            from_user = (msg.get("from") or {}).get("user") or {}
            if args.exclude_self and from_user.get("id") == creds["client_id"]:
                continue
            seen.add(mid)
            new_msgs.append({
                "id": mid,
                "createdDateTime": msg.get("createdDateTime"),
                "from": from_user.get("displayName"),
                "from_id": from_user.get("id"),
                "content": (msg.get("body") or {}).get("content", ""),
                "contentType": (msg.get("body") or {}).get("contentType"),
            })
        if new_msgs:
            new_msgs.sort(key=lambda m: m["createdDateTime"])
            print(json.dumps(new_msgs, indent=2, ensure_ascii=False))
            return 0
        time.sleep(args.poll_interval)

    print(json.dumps([], indent=2))
    print(f"TIMEOUT: nenhuma mensagem nova em {args.timeout}s", file=sys.stderr)
    return 3


def cmd_list_teams(args: argparse.Namespace) -> int:
    creds = _get_graph_credentials(args.graph_secret, args.skill)
    token = _get_access_token(creds)
    data = _graph(
        "GET", "/teams", token,
        params={"$top": 100, "$select": "id,displayName,description"},
    )
    teams = [
        {"id": t["id"], "name": t.get("displayName", ""), "description": t.get("description", "")}
        for t in (data or {}).get("value", [])
    ]
    print(json.dumps(teams, indent=2, ensure_ascii=False))
    return 0


def cmd_list_channels(args: argparse.Namespace) -> int:
    creds = _get_graph_credentials(args.graph_secret, args.skill)
    token = _get_access_token(creds)
    team_id = _resolve_team_id(token, args.team)
    data = _graph("GET", f"/teams/{team_id}/channels", token)
    channels = [
        {
            "id": c["id"], "name": c.get("displayName", ""),
            "description": c.get("description", ""),
            "membershipType": c.get("membershipType"),
        }
        for c in (data or {}).get("value", [])
    ]
    print(json.dumps(channels, indent=2, ensure_ascii=False))
    return 0


def cmd_resolve(args: argparse.Namespace) -> int:
    creds = _get_graph_credentials(args.graph_secret, args.skill)
    token = _get_access_token(creds)
    team_id = _resolve_team_id(token, args.team)
    out: dict = {"team_id": team_id}
    if args.channel:
        out["channel_id"] = _resolve_channel_id(token, team_id, args.channel)
    print(json.dumps(out, indent=2, ensure_ascii=False))
    return 0


# ═════════════════════════════════════════════════════════════════════════════
# CLI
# ═════════════════════════════════════════════════════════════════════════════
def _add_skill_arg(p: argparse.ArgumentParser) -> None:
    p.add_argument(
        "--skill", default="intelliforce-teams",
        help="Slug da skill que está chamando (audit log Vault). Default: intelliforce-teams",
    )


def _add_secret_args(p: argparse.ArgumentParser) -> None:
    p.add_argument(
        "--webhook-secret", default=DEFAULT_WEBHOOK_SLUG,
        help=f"Slug do secret webhook no Vault. Default: {DEFAULT_WEBHOOK_SLUG}",
    )
    p.add_argument(
        "--graph-secret", default=DEFAULT_GRAPH_SLUG,
        help=f"Slug do secret Graph no Vault. Default: {DEFAULT_GRAPH_SLUG}",
    )


def _add_via_arg(p: argparse.ArgumentParser) -> None:
    p.add_argument(
        "--via", choices=["webhook", "graph"], default="webhook",
        help="webhook (default, simples, one-way) ou graph (avançado, bidirecional)",
    )


def _add_team_channel_args(p: argparse.ArgumentParser, required: bool) -> None:
    p.add_argument(
        "--team", required=required,
        help="(Graph only) Team ID UUID ou displayName",
    )
    p.add_argument(
        "--channel", required=required,
        help="(Graph only) Channel ID ou displayName",
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Microsoft Teams: webhook (default) ou Graph API.",
        epilog=(
            "Webhook: cadastre `teams-webhook-<channel>` no Vault com campo "
            "url. Graph: cadastre `microsoft-teams` com client_id, "
            "client_secret, tenant_id."
        ),
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    # ── send ──
    p_send = sub.add_parser("send", help="Manda mensagem texto simples.")
    p_send.add_argument("--message", required=True)
    p_send.add_argument("--subject", default=None, help="Título/assunto opcional")
    p_send.add_argument("--footer", default=None, help="(webhook) Footer custom")
    _add_via_arg(p_send)
    _add_team_channel_args(p_send, required=False)  # required só se --via graph
    p_send.add_argument("--mention", default=None, help="(graph) UPN da pessoa pra mencionar")
    p_send.add_argument("--html", action="store_true", help="(graph) Trata --message como HTML")
    _add_secret_args(p_send)
    _add_skill_arg(p_send)

    # ── send-card ──
    p_card = sub.add_parser("send-card", help="Manda Adaptive Card customizado.")
    p_card.add_argument("--card-file", default=None)
    p_card.add_argument("--card-json", default=None)
    _add_via_arg(p_card)
    _add_team_channel_args(p_card, required=False)
    _add_secret_args(p_card)
    _add_skill_arg(p_card)

    # ── listen (graph only) ──
    p_listen = sub.add_parser("listen", help="(graph) Polla mensagens novas até timeout.")
    _add_team_channel_args(p_listen, required=True)
    p_listen.add_argument("--since", default=None, help="ISO 8601; default: agora")
    p_listen.add_argument("--timeout", type=int, default=300)
    p_listen.add_argument("--poll-interval", type=int, default=15)
    p_listen.add_argument("--exclude-self", action="store_true")
    _add_secret_args(p_listen)
    _add_skill_arg(p_listen)

    # ── list-teams (graph only) ──
    p_lt = sub.add_parser("list-teams", help="(graph) Lista teams da org.")
    _add_secret_args(p_lt)
    _add_skill_arg(p_lt)

    # ── list-channels (graph only) ──
    p_lc = sub.add_parser("list-channels", help="(graph) Lista channels de um team.")
    p_lc.add_argument("--team", required=True, help="Team ID/nome")
    _add_secret_args(p_lc)
    _add_skill_arg(p_lc)

    # ── resolve (graph only) ──
    p_r = sub.add_parser("resolve", help="(graph) Resolve nomes → UUIDs.")
    p_r.add_argument("--team", required=True)
    p_r.add_argument("--channel", default=None)
    _add_secret_args(p_r)
    _add_skill_arg(p_r)

    args = parser.parse_args()
    handlers = {
        "send": cmd_send,
        "send-card": cmd_send_card,
        "listen": cmd_listen,
        "list-teams": cmd_list_teams,
        "list-channels": cmd_list_channels,
        "resolve": cmd_resolve,
    }
    return handlers[args.cmd](args)


if __name__ == "__main__":
    sys.exit(main())
