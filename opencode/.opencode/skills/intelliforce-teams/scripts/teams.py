#!/usr/bin/env python3
"""teams.py — Microsoft Teams via Graph API (app-only).

Lê credenciais do Vault (slug 'microsoft-teams' com fields client_id,
client_secret, tenant_id), obtém access_token via client credentials flow
e suporta:

  send            — manda mensagem em channel
  listen          — polla até mensagem nova (ou timeout)
  list-teams      — descobre team_ids da org
  list-channels   — descobre channel_ids dentro de um team
  resolve         — resolve nome ↔ ID de team/channel

Convenções de output:
  - stdout: JSON pretty-printed (parsable pelo operator)
  - stderr: erros categóricos (TOKEN_EMPTY, AUTH_ERROR_<n>, etc.)
  - exit:   0 sucesso, 1 erro recuperável, 2 erro de uso, 3 timeout em listen

Limitações conhecidas (app-only auth):
  - DM 1:1 NÃO suportado (requer Bot Framework ou delegated auth)
  - Mention de pessoa funciona só dentro de message em channel/chat
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from datetime import datetime, timezone

import httpx

VAULT_SCRIPT = "/opencode-runtime/.opencode/skills/intelliforce-vault/scripts/vault.py"
VAULT_SLUG = "microsoft-teams"
GRAPH_BASE = "https://graph.microsoft.com/v1.0"
TOKEN_URL = "https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"


# ─────────────────────────────────────────────────────────────────────────────
# Vault + auth
# ─────────────────────────────────────────────────────────────────────────────
def _get_credentials(skill_slug: str) -> dict[str, str]:
    """Busca client_id/client_secret/tenant_id do Vault (1 chamada, all-fields)."""
    result = subprocess.run(
        [
            "python", VAULT_SCRIPT, "get", VAULT_SLUG,
            "--skill", skill_slug,
            "--all-fields",
        ],
        capture_output=True, text=True, timeout=20,
    )
    if result.returncode != 0:
        err = result.stderr.strip()
        if "SECRET_NOT_FOUND" in err:
            print(
                f"VAULT_MISSING: cadastre o secret '{VAULT_SLUG}' em /vault "
                "com os campos client_id, client_secret, tenant_id",
                file=sys.stderr,
            )
        else:
            print(f"VAULT_ERROR: {err}", file=sys.stderr)
        sys.exit(1)

    try:
        creds = json.loads(result.stdout)
    except json.JSONDecodeError:
        print("VAULT_INVALID_JSON", file=sys.stderr)
        sys.exit(1)

    required = {"client_id", "client_secret", "tenant_id"}
    missing = required - set(creds.keys())
    if missing:
        print(
            f"VAULT_MISSING_FIELDS: secret '{VAULT_SLUG}' está sem "
            f"{', '.join(sorted(missing))}",
            file=sys.stderr,
        )
        sys.exit(1)
    return creds


def _get_access_token(creds: dict[str, str]) -> str:
    """Client credentials flow → access_token (~60min TTL)."""
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
        # Erro típico: invalid_client (secret expirado), AADSTS70011 (scope inválido)
        try:
            err_body = r.json()
            err_code = err_body.get("error", "unknown")
            err_desc = err_body.get("error_description", "")[:300]
            print(f"AUTH_ERROR_{r.status_code}: {err_code} — {err_desc}", file=sys.stderr)
        except Exception:
            print(f"AUTH_ERROR_{r.status_code}: {r.text[:300]}", file=sys.stderr)
        sys.exit(1)
    return r.json()["access_token"]


# ─────────────────────────────────────────────────────────────────────────────
# Graph wrapper
# ─────────────────────────────────────────────────────────────────────────────
def _graph(
    method: str,
    path: str,
    token: str,
    *,
    json_body=None,
    params=None,
    timeout: float = 20.0,
):
    """Chamada Graph com tratamento padronizado de erros."""
    url = f"{GRAPH_BASE}{path}"
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    if json_body is not None:
        headers["Content-Type"] = "application/json"
    try:
        r = httpx.request(
            method, url, headers=headers, json=json_body, params=params, timeout=timeout
        )
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        sys.exit(1)

    if r.status_code == 401:
        print("TOKEN_REJECTED: access_token inválido ou expirado", file=sys.stderr)
        sys.exit(1)
    if r.status_code == 403:
        try:
            err_body = r.json().get("error", {})
            msg = err_body.get("message", r.text[:300])
            code = err_body.get("code", "")
            print(f"PERMISSION_DENIED ({code}): {msg}", file=sys.stderr)
        except Exception:
            print(f"PERMISSION_DENIED: {r.text[:300]}", file=sys.stderr)
        print(
            "→ Verifique se o app tem permissions Application no Azure AD "
            "(ChannelMessage.Send.Group, ChannelMessage.Read.Group, etc.) "
            "e se admin consent foi concedido.",
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


# ─────────────────────────────────────────────────────────────────────────────
# Resolvers (nome → ID)
# ─────────────────────────────────────────────────────────────────────────────
def _resolve_team_id(token: str, name_or_id: str) -> str:
    """Aceita UUID ou nome. Se UUID, retorna direto. Se nome, busca via /teams."""
    if _looks_like_uuid(name_or_id):
        return name_or_id
    # /teams (Team.ReadBasic.All) — endpoint específico de Teams.
    # Evita /groups que exigiria Group.Read.All adicional.
    data = _graph(
        "GET", "/teams", token,
        params={"$top": 100, "$select": "id,displayName"},
    )
    for t in (data or {}).get("value", []):
        if t.get("displayName", "").strip().lower() == name_or_id.strip().lower():
            return t["id"]
    available = [t.get("displayName") for t in (data or {}).get("value", [])]
    print(
        f"TEAM_NOT_FOUND: '{name_or_id}'. Disponíveis: {available}",
        file=sys.stderr,
    )
    sys.exit(1)


def _resolve_channel_id(token: str, team_id: str, name_or_id: str) -> str:
    if name_or_id.startswith("19:"):
        return name_or_id  # já é channel ID no formato Graph
    data = _graph("GET", f"/teams/{team_id}/channels", token)
    for c in (data or {}).get("value", []):
        if c.get("displayName", "").strip().lower() == name_or_id.strip().lower():
            return c["id"]
    available = [c.get("displayName") for c in (data or {}).get("value", [])]
    print(
        f"CHANNEL_NOT_FOUND: '{name_or_id}' no team. Disponíveis: {available}",
        file=sys.stderr,
    )
    sys.exit(1)


def _looks_like_uuid(s: str) -> bool:
    return len(s) == 36 and s.count("-") == 4


# ─────────────────────────────────────────────────────────────────────────────
# Comandos
# ─────────────────────────────────────────────────────────────────────────────
def cmd_send(args: argparse.Namespace) -> int:
    creds = _get_credentials(args.skill)
    token = _get_access_token(creds)

    team_id = _resolve_team_id(token, args.team)
    channel_id = _resolve_channel_id(token, team_id, args.channel)

    content = args.message
    mentions = []

    if args.mention:
        # Resolve UPN (e-mail) → user object pra construir mention HTML
        user = _graph("GET", f"/users/{args.mention}", token)
        if user:
            mention_id = 0
            display = user.get("displayName") or args.mention
            content = f'<at id="{mention_id}">{display}</at> {content}'
            mentions.append({
                "id": mention_id,
                "mentionText": display,
                "mentioned": {
                    "user": {
                        "id": user["id"],
                        "displayName": display,
                        "userIdentityType": "aadUser",
                    }
                },
            })

    body: dict = {
        "body": {
            "content": content,
            "contentType": "html" if (args.mention or args.html) else "text",
        }
    }
    if mentions:
        body["mentions"] = mentions
    if args.subject:
        body["subject"] = args.subject

    result = _graph(
        "POST",
        f"/teams/{team_id}/channels/{channel_id}/messages",
        token,
        json_body=body,
    )
    print(json.dumps({
        "ok": True,
        "id": (result or {}).get("id"),
        "createdDateTime": (result or {}).get("createdDateTime"),
        "webUrl": (result or {}).get("webUrl"),
        "team_id": team_id,
        "channel_id": channel_id,
    }, indent=2, ensure_ascii=False))
    return 0


def cmd_listen(args: argparse.Namespace) -> int:
    """Polla mensagens novas até a 1ª aparecer ou timeout."""
    creds = _get_credentials(args.skill)
    token = _get_access_token(creds)

    team_id = _resolve_team_id(token, args.team)
    channel_id = _resolve_channel_id(token, team_id, args.channel)

    if args.since:
        since_dt = datetime.fromisoformat(args.since.replace("Z", "+00:00"))
    else:
        since_dt = datetime.now(timezone.utc)

    deadline = time.monotonic() + args.timeout
    seen_ids: set[str] = set()

    while time.monotonic() < deadline:
        data = _graph(
            "GET",
            f"/teams/{team_id}/channels/{channel_id}/messages",
            token,
            params={"$top": 20},
        )
        new_msgs = []
        for msg in (data or {}).get("value", []):
            mid = msg.get("id")
            if not mid or mid in seen_ids:
                continue
            try:
                created = datetime.fromisoformat(
                    msg.get("createdDateTime", "").replace("Z", "+00:00")
                )
            except (ValueError, AttributeError):
                continue
            if created <= since_dt:
                continue

            # Filtra mensagens do próprio bot/app pra não auto-loopar
            from_user = (msg.get("from") or {}).get("user") or {}
            if args.exclude_self and from_user.get("id") == creds["client_id"]:
                continue

            seen_ids.add(mid)
            new_msgs.append({
                "id": mid,
                "createdDateTime": msg.get("createdDateTime"),
                "from": from_user.get("displayName"),
                "from_id": from_user.get("id"),
                "content": (msg.get("body") or {}).get("content", ""),
                "contentType": (msg.get("body") or {}).get("contentType"),
            })

        if new_msgs:
            # Ordena cronologicamente (Graph retorna desc por default)
            new_msgs.sort(key=lambda m: m["createdDateTime"])
            print(json.dumps(new_msgs, indent=2, ensure_ascii=False))
            return 0

        time.sleep(args.poll_interval)

    print(json.dumps([], indent=2))
    print(
        f"TIMEOUT: nenhuma mensagem nova em {args.timeout}s",
        file=sys.stderr,
    )
    return 3


def cmd_list_teams(args: argparse.Namespace) -> int:
    creds = _get_credentials(args.skill)
    token = _get_access_token(creds)
    # GET /teams requer Team.ReadBasic.All (Application). Mais barato que
    # GET /groups com filter (que exigiria Group.Read.All).
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
    creds = _get_credentials(args.skill)
    token = _get_access_token(creds)
    team_id = _resolve_team_id(token, args.team)
    data = _graph("GET", f"/teams/{team_id}/channels", token)
    channels = [
        {
            "id": c["id"],
            "name": c.get("displayName", ""),
            "description": c.get("description", ""),
            "membershipType": c.get("membershipType"),
        }
        for c in (data or {}).get("value", [])
    ]
    print(json.dumps(channels, indent=2, ensure_ascii=False))
    return 0


def cmd_resolve(args: argparse.Namespace) -> int:
    """Resolve nome → IDs. Útil pra debug/setup."""
    creds = _get_credentials(args.skill)
    token = _get_access_token(creds)
    team_id = _resolve_team_id(token, args.team)
    out: dict = {"team_id": team_id}
    if args.channel:
        out["channel_id"] = _resolve_channel_id(token, team_id, args.channel)
    print(json.dumps(out, indent=2, ensure_ascii=False))
    return 0


# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────
def main() -> int:
    parser = argparse.ArgumentParser(
        description="Microsoft Teams via Graph API (app-only).",
        epilog="Cadastre o secret 'microsoft-teams' no Vault antes de usar.",
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    # Argumento comum a todos: --skill (audit log do Vault)
    def add_skill_arg(p):
        p.add_argument(
            "--skill", default="intelliforce-teams",
            help="Slug da skill que está chamando (audit log). Default: intelliforce-teams.",
        )

    p_send = sub.add_parser("send", help="Manda mensagem em channel.")
    p_send.add_argument("--team", required=True, help="Team ID (UUID) ou displayName")
    p_send.add_argument("--channel", required=True, help="Channel ID ou displayName")
    p_send.add_argument("--message", required=True, help="Texto da mensagem")
    p_send.add_argument("--mention", default=None, help="UPN/e-mail da pessoa pra mencionar (notifica)")
    p_send.add_argument("--subject", default=None, help="Assunto opcional (vira título)")
    p_send.add_argument("--html", action="store_true", help="Trata --message como HTML")
    add_skill_arg(p_send)

    p_listen = sub.add_parser("listen", help="Polla até mensagem nova ou timeout.")
    p_listen.add_argument("--team", required=True)
    p_listen.add_argument("--channel", required=True)
    p_listen.add_argument("--since", default=None, help="ISO 8601; default: agora")
    p_listen.add_argument("--timeout", type=int, default=300, help="Segundos. Default 300.")
    p_listen.add_argument("--poll-interval", type=int, default=15, help="Segundos. Default 15.")
    p_listen.add_argument(
        "--exclude-self", action="store_true",
        help="Ignora mensagens enviadas pelo próprio app (evita auto-loop)",
    )
    add_skill_arg(p_listen)

    p_list_teams = sub.add_parser("list-teams", help="Lista teams da org.")
    add_skill_arg(p_list_teams)

    p_list_channels = sub.add_parser("list-channels", help="Lista channels de um team.")
    p_list_channels.add_argument("--team", required=True)
    add_skill_arg(p_list_channels)

    p_resolve = sub.add_parser("resolve", help="Resolve nomes → IDs.")
    p_resolve.add_argument("--team", required=True)
    p_resolve.add_argument("--channel", default=None)
    add_skill_arg(p_resolve)

    args = parser.parse_args()
    handlers = {
        "send": cmd_send,
        "listen": cmd_listen,
        "list-teams": cmd_list_teams,
        "list-channels": cmd_list_channels,
        "resolve": cmd_resolve,
    }
    return handlers[args.cmd](args)


if __name__ == "__main__":
    sys.exit(main())
