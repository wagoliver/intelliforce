#!/usr/bin/env python3
"""teams.py — Microsoft Teams via Power Automate webhook (one-way).

Manda mensagem em channel do Teams disparando um flow do Power Automate
que recebe um Adaptive Card no body e posta no channel-alvo. URL do
trigger fica criptografada no Vault — slug default `teams-webhook-digital-employee`
com campo único `url`.

Suporta:
  send       — mensagem texto simples (monta Adaptive Card mínimo)
  send-card  — Adaptive Card customizado (de arquivo, inline JSON ou stdin)

Limitações conhecidas:
  - One-way: não recebe respostas (use Graph API + RSC pra listen)
  - 1 webhook por channel: pra postar em outro channel, criar outro flow
    no Power Automate e cadastrar como secret separado.

Por que webhook em vez de Graph API:
  Graph API exige RSC (Resource-Specific Consent) pra postar em channel,
  o que requer Teams App package + admin consent + install no team. Em
  tenants com policy restritiva (caso da Arctica), isso fica bloqueado
  por "Permissions needed". Webhook contorna 100% dessa cadeia — só
  precisa criar o flow uma vez e a URL no Vault.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import httpx

VAULT_SCRIPT = "/opencode-runtime/.opencode/skills/intelliforce-vault/scripts/vault.py"
DEFAULT_WEBHOOK_SLUG = "teams-webhook-digital-employee"


# ─────────────────────────────────────────────────────────────────────────────
# Vault
# ─────────────────────────────────────────────────────────────────────────────
def _get_webhook_url(secret_slug: str, skill_slug: str) -> str:
    """Lê o campo `url` do secret <slug> no Vault."""
    result = subprocess.run(
        [
            "python", VAULT_SCRIPT, "get", secret_slug,
            "--skill", skill_slug,
            "--field", "url",
        ],
        capture_output=True, text=True, timeout=20,
    )
    if result.returncode != 0:
        err = result.stderr.strip()
        if "SECRET_NOT_FOUND" in err:
            print(
                f"VAULT_MISSING: cadastre o secret '{secret_slug}' em /vault "
                "com o campo `url` (URL do trigger HTTP do Power Automate flow).",
                file=sys.stderr,
            )
        elif "API_ERROR_404" in err and "Campo" in err:
            print(
                f"VAULT_FIELD_MISSING: o secret '{secret_slug}' existe mas não "
                "tem campo `url`. Recadastre.",
                file=sys.stderr,
            )
        else:
            print(f"VAULT_ERROR: {err}", file=sys.stderr)
        sys.exit(1)
    url = result.stdout.strip()
    if not url:
        print(f"VAULT_FIELD_EMPTY: secret '{secret_slug}' campo `url` vazio", file=sys.stderr)
        sys.exit(1)
    return url


# ─────────────────────────────────────────────────────────────────────────────
# Adaptive Card builder (mensagem simples)
# ─────────────────────────────────────────────────────────────────────────────
def _build_simple_card(
    *,
    message: str,
    subject: str | None = None,
    footer: str | None = None,
) -> dict:
    """Monta Adaptive Card mínimo a partir de texto.

    Layout:
      [Subject (bold, medium)]   ← se passado
      [Message body (wrap)]
      [Footer (subtle, small)]   ← timestamp + identificação
    """
    body: list[dict] = []
    if subject:
        body.append({
            "type": "TextBlock",
            "text": subject,
            "weight": "bolder",
            "size": "medium",
            "wrap": True,
        })
    body.append({
        "type": "TextBlock",
        "text": message,
        "wrap": True,
    })
    auto_footer = footer or (
        "via IntelliForce · "
        + datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    )
    body.append({
        "type": "TextBlock",
        "text": auto_footer,
        "size": "small",
        "isSubtle": True,
        "spacing": "small",
        "wrap": True,
    })

    return {
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "type": "AdaptiveCard",
        "version": "1.4",
        "body": body,
    }


def _load_card(args: argparse.Namespace) -> dict:
    """Carrega Adaptive Card de --card-file, --card-json ou stdin."""
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
        print(
            "CARD_INPUT_MISSING: passe --card-file <path>, --card-json '<json>', "
            "ou pipe via stdin.",
            file=sys.stderr,
        )
        sys.exit(2)

    try:
        card = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"CARD_INVALID_JSON: {e}", file=sys.stderr)
        sys.exit(2)

    # Algumas pessoas mandam {contentType, content}. Desempacota.
    if isinstance(card, dict) and "content" in card and "contentType" in card:
        card = card["content"]

    if not isinstance(card, dict) or card.get("type") != "AdaptiveCard":
        print(
            "CARD_INVALID_SHAPE: a raiz do JSON precisa ter `type: \"AdaptiveCard\"`. "
            "Não use o wrapper {contentType, content} — manda o card direto.",
            file=sys.stderr,
        )
        sys.exit(2)
    return card


# ─────────────────────────────────────────────────────────────────────────────
# HTTP
# ─────────────────────────────────────────────────────────────────────────────
def _post_to_webhook(url: str, card: dict) -> int:
    try:
        r = httpx.post(url, json=card, timeout=20.0)
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        return 1

    # Power Automate retorna 202 Accepted em sucesso (processa async)
    if r.status_code in (200, 202, 204):
        out = {
            "ok": True,
            "status": r.status_code,
            "sent_at": datetime.now(timezone.utc).isoformat(),
        }
        print(json.dumps(out, ensure_ascii=False))
        return 0

    # Erros: corpo geralmente tem detalhe
    body_preview = r.text[:400] if r.text else "(empty body)"
    if r.status_code == 401 or r.status_code == 403:
        print(
            f"WEBHOOK_UNAUTHORIZED ({r.status_code}): a URL do webhook está "
            "inválida ou expirada. Re-gere a URL no Power Automate e atualize "
            f"o Vault. Detalhe: {body_preview}",
            file=sys.stderr,
        )
        return 1
    if r.status_code == 404:
        print(
            f"WEBHOOK_NOT_FOUND (404): o flow do Power Automate foi deletado "
            f"ou a URL está errada. Detalhe: {body_preview}",
            file=sys.stderr,
        )
        return 1
    if r.status_code == 400:
        print(
            f"WEBHOOK_BAD_REQUEST (400): o Power Automate rejeitou o body. "
            f"Geralmente é shape do Adaptive Card inválido. Detalhe: {body_preview}",
            file=sys.stderr,
        )
        return 1
    print(f"WEBHOOK_ERROR_{r.status_code}: {body_preview}", file=sys.stderr)
    return 1


# ─────────────────────────────────────────────────────────────────────────────
# Comandos
# ─────────────────────────────────────────────────────────────────────────────
def cmd_send(args: argparse.Namespace) -> int:
    url = _get_webhook_url(args.webhook_secret, args.skill)
    card = _build_simple_card(
        message=args.message,
        subject=args.subject,
        footer=args.footer,
    )
    return _post_to_webhook(url, card)


def cmd_send_card(args: argparse.Namespace) -> int:
    url = _get_webhook_url(args.webhook_secret, args.skill)
    card = _load_card(args)
    return _post_to_webhook(url, card)


# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────
def _add_common_args(p: argparse.ArgumentParser) -> None:
    p.add_argument(
        "--webhook-secret",
        default=DEFAULT_WEBHOOK_SLUG,
        help=f"Slug do secret no Vault com campo `url`. Default: {DEFAULT_WEBHOOK_SLUG}",
    )
    p.add_argument(
        "--skill",
        default="intelliforce-teams",
        help="Slug da skill que está chamando (audit log do Vault). Default: intelliforce-teams",
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Microsoft Teams via Power Automate webhook (one-way).",
        epilog=(
            "Setup: criar flow no Power Automate com trigger "
            "'When an HTTP request is received' + step "
            "'Post card in a chat or channel'. Copiar URL do trigger e "
            f"cadastrar no Vault no slug `{DEFAULT_WEBHOOK_SLUG}` "
            "(campo `url`)."
        ),
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    # send — mensagem texto simples (Adaptive Card mínimo gerado internamente)
    p_send = sub.add_parser("send", help="Manda mensagem texto simples no channel.")
    p_send.add_argument("--message", required=True, help="Texto principal da mensagem.")
    p_send.add_argument("--subject", default=None, help="Título/assunto opcional (bold).")
    p_send.add_argument("--footer", default=None, help="Footer custom (default: timestamp + IntelliForce).")
    _add_common_args(p_send)

    # send-card — Adaptive Card customizado completo
    p_card = sub.add_parser(
        "send-card",
        help="Manda Adaptive Card customizado (de arquivo, inline JSON, ou stdin).",
    )
    p_card.add_argument("--card-file", default=None, help="Path pra arquivo .json com o card.")
    p_card.add_argument("--card-json", default=None, help="JSON inline (escape aspas).")
    _add_common_args(p_card)

    args = parser.parse_args()
    handlers = {"send": cmd_send, "send-card": cmd_send_card}
    return handlers[args.cmd](args)


if __name__ == "__main__":
    sys.exit(main())
