#!/usr/bin/env python3
"""
Consulta o histórico completo de um ticket específico no Zoho Desk.
Busca credenciais no Vault, renova token em memória, retorna JSON bruto.

Uso:
  python zoho_ticket_history.py --ticket-number 1913
  python zoho_ticket_history.py --ticket-id 658772000020421294

Use --ticket-number com o número visível do ticket (ex: 1913) ou
--ticket-id com o ID interno do Zoho. São mutuamente exclusivos.
"""
import argparse
import json
import subprocess
import sys

import httpx as requests   # alias pra preservar code-style; `httpx.get/post` é drop-in compat

# ──────────────────────────────────────────
# Configurações estáticas
# ──────────────────────────────────────────
TOKEN_URL = "https://accounts.zoho.com/oauth/v2/token"
ZOHO_BASE = "https://desk.zoho.com/api/v1"
ORG_ID = "762214676"
VAULT_SCRIPT = "/opencode-runtime/.opencode/skills/intelliforce-vault/scripts/vault.py"
SKILL_SLUG = "consulta-zoho-ticket-history"

# ──────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────
def get_vault_credentials(slug: str) -> dict:
    """Busca credenciais multi-campo do Vault. Sai com erro se falhar."""
    result = subprocess.run(
        [
            "python", VAULT_SCRIPT, "get", slug,
            "--skill", SKILL_SLUG,
            "--all-fields",
        ],
        capture_output=True, text=True, timeout=20,
    )
    if result.returncode != 0:
        print(
            f"Erro ao buscar credenciais '{slug}' no Vault: {result.stderr.strip()}",
            file=sys.stderr,
        )
        sys.exit(1)
    return json.loads(result.stdout)


def refresh_access_token(client_id: str, client_secret: str, refresh_token: str) -> str:
    """Renova o access token via OAuth 2.0."""
    payload = {
        "refresh_token": refresh_token,
        "client_id": client_id,
        "client_secret": client_secret,
        "grant_type": "refresh_token",
    }
    resp = requests.post(TOKEN_URL, data=payload, timeout=15)
    if resp.status_code != 200:
        print(
            f"Erro ao renovar token: {resp.status_code} - {resp.text}",
            file=sys.stderr,
        )
        sys.exit(1)
    return resp.json().get("access_token")


def resolve_internal_id(ticket_number: str, access_token: str) -> str:
    """
    Varre a lista de tickets (paginado) até encontrar o ticketNumber
    informado e retorna o ID interno do Zoho.
    """
    headers = {
        "Authorization": f"Zoho-oauthtoken {access_token}",
        "orgId": ORG_ID,
    }
    from_index = 0
    while True:
        resp = requests.get(
            f"{ZOHO_BASE}/tickets",
            headers=headers,
            params={"from": from_index, "limit": 50},
            timeout=15,
        )
        if resp.status_code != 200:
            print(
                f"Erro ao listar tickets: {resp.status_code} - {resp.text}",
                file=sys.stderr,
            )
            sys.exit(1)

        data = resp.json().get("data", [])
        if not data:
            break

        for t in data:
            if str(t.get("ticketNumber")) == str(ticket_number):
                return t["id"]

        if len(data) < 50:
            break
        from_index += 50

    print(f"Ticket '{ticket_number}' não encontrado na lista de tickets.", file=sys.stderr)
    sys.exit(1)


def fetch_ticket_history(ticket_id: str, access_token: str) -> str:
    """Busca o histórico completo de um ticket e retorna o JSON bruto."""
    headers = {
        "Authorization": f"Zoho-oauthtoken {access_token}",
        "orgId": ORG_ID,
    }
    resp = requests.get(
        f"{ZOHO_BASE}/tickets/{ticket_id}/history",
        headers=headers,
        timeout=15,
    )
    if resp.status_code != 200:
        print(
            f"Erro ao buscar histórico do ticket {ticket_id}: "
            f"{resp.status_code} - {resp.text}",
            file=sys.stderr,
        )
        sys.exit(1)
    return resp.text


# ──────────────────────────────────────────
# Main
# ──────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="Consulta o histórico completo de um ticket no Zoho Desk.",
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--ticket-number",
        default=None,
        help="Número visível do ticket (ex: 1913). Faz lookup automático do ID interno.",
    )
    group.add_argument(
        "--ticket-id",
        default=None,
        help="ID interno do ticket no Zoho Desk (ex: 658772000020421294).",
    )
    args = parser.parse_args()

    # 1. Credenciais do Vault (secret multi-campo `zoho`)
    creds = get_vault_credentials("zoho")
    client_id     = creds["client_id"]
    client_secret = creds["client_secret"]
    refresh_token = creds["refresh_token"]

    # 2. Renova token
    access_token = refresh_access_token(client_id, client_secret, refresh_token)

    # 3. Resolve ID interno se usou --ticket-number
    if args.ticket_number:
        internal_id = resolve_internal_id(args.ticket_number, access_token)
    else:
        internal_id = args.ticket_id

    # 4. Busca histórico do ticket
    history_json = fetch_ticket_history(internal_id, access_token)

    # 5. Imprime JSON bruto
    print(history_json)


if __name__ == "__main__":
    main()
