#!/usr/bin/env python3
"""
Consulta tickets abertos N1/N2 no Zoho Desk.
Busca credenciais no Vault, renova token em memória, retorna JSON.

Uso:
  python zoho_tickets.py
  python zoho_tickets.py --since 2026-05-04T10:00:00Z

`--since` filtra tickets com createdTime > timestamp ISO 8601 — útil
pra workflows recorrentes (cron) que processam só tickets novos sem
duplicar trabalho. Filtro é aplicado em memória após o fetch
(simplicidade > performance — Zoho `where` server-side tem sintaxe
quebradiça entre versões).
"""
import argparse
import json
import os
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

import httpx as requests   # alias pra preservar code-style; `httpx.get/post` é drop-in compat

# ──────────────────────────────────────────
# Configurações estáticas
# ──────────────────────────────────────────
TOKEN_URL = "https://accounts.zoho.com/oauth/v2/token"
ZOHO_BASE = "https://desk.zoho.com/api/v1"
ORG_ID = "762214676"
MAX_WORKERS = 5
VAULT_SCRIPT = "/opencode-runtime/.opencode/skills/intelliforce-vault/scripts/vault.py"
SKILL_SLUG = "consulta-zoho-tickets"

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


def strip_html(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def parse_iso(s: str) -> datetime:
    """Parse ISO 8601 tolerante — aceita 'Z' como sufixo UTC e força tzinfo
    se ausente. Lança ValueError pra strings malformadas."""
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


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


def fetch_all_tickets(access_token: str) -> list:
    """Lista todos os tickets abertos (paginado)."""
    headers = {
        "Authorization": f"Zoho-oauthtoken {access_token}",
        "orgId": ORG_ID,
    }
    open_ids = []
    from_index = 0

    while True:
        resp = requests.get(
            f"{ZOHO_BASE}/tickets",
            headers=headers,
            params={"from": from_index, "limit": 50},
            timeout=15,
        )
        if resp.status_code != 200:
            print(f"Erro na listagem: {resp.status_code} - {resp.text}", file=sys.stderr)
            break

        data = resp.json().get("data", [])
        if not data:
            break

        for t in data:
            if t.get("statusType") != "Closed":
                open_ids.append(t["id"])

        if len(data) < 50:
            break
        from_index += 50

    return open_ids


def fetch_ticket_detail(ticket_id: str, headers: dict) -> dict:
    """Busca detalhe de um ticket específico."""
    try:
        resp = requests.get(
            f"{ZOHO_BASE}/tickets/{ticket_id}",
            headers=headers,
            timeout=15,
        )
        if resp.status_code == 200:
            return resp.json()
    except Exception as e:
        print(f"Erro ao buscar ticket {ticket_id}: {e}", file=sys.stderr)
    return None


def fetch_agents(access_token: str) -> dict:
    """Carrega dicionário {agent_id: nome}."""
    headers = {
        "Authorization": f"Zoho-oauthtoken {access_token}",
        "orgId": ORG_ID,
    }
    agentes = {}
    from_idx = 0
    while True:
        resp = requests.get(
            f"{ZOHO_BASE}/agents",
            headers=headers,
            params={"from": from_idx, "limit": 100},
            timeout=15,
        )
        if resp.status_code != 200:
            print(f"Aviso: não foi possível carregar agentes ({resp.status_code})", file=sys.stderr)
            break
        data = resp.json().get("data", [])
        for agent in data:
            agentes[agent["id"]] = agent.get("fullName") or agent.get("firstName", "")
        if len(data) < 100:
            break
        from_idx += 100
    return agentes


# ──────────────────────────────────────────
# Main
# ──────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="Consulta tickets abertos N1/N2 no Zoho Desk.",
    )
    parser.add_argument(
        "--since",
        default=None,
        help=(
            "ISO 8601 (ex: 2026-05-04T10:00:00Z). Filtra tickets com "
            "createdTime > este valor. Sem flag: retorna todos os abertos N1/N2."
        ),
    )
    args = parser.parse_args()

    since_dt: datetime | None = None
    if args.since:
        try:
            since_dt = parse_iso(args.since)
        except ValueError as e:
            print(f"INVALID_SINCE: '{args.since}' não é ISO 8601 válido — {e}", file=sys.stderr)
            sys.exit(2)

    # 1. Credenciais do Vault (secret multi-campo `zoho`)
    creds = get_vault_credentials("zoho")
    client_id     = creds["client_id"]
    client_secret = creds["client_secret"]
    refresh_token = creds["refresh_token"]

    # 2. Renova token
    access_token = refresh_access_token(client_id, client_secret, refresh_token)

    headers = {
        "Authorization": f"Zoho-oauthtoken {access_token}",
        "orgId": ORG_ID,
    }

    # 3. Carrega agentes
    agentes = fetch_agents(access_token)

    # 4. Lista tickets abertos
    open_ticket_ids = fetch_all_tickets(access_token)

    # 5. Busca detalhes em paralelo
    detalhes = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(fetch_ticket_detail, tid, headers): tid for tid in open_ticket_ids}
        for future in as_completed(futures):
            result = future.result()
            if result:
                detalhes.append(result)

    # 6. Filtra N1/N2 + (opcional) since
    def passa_filtros(t: dict) -> bool:
        if (t.get("cf") or {}).get("cf_nivel_de_suporte") not in ("N1", "N2"):
            return False
        if since_dt is not None:
            created_str = t.get("createdTime")
            if not created_str:
                return False  # sem timestamp não dá pra comparar — descarta
            try:
                created_dt = parse_iso(created_str)
            except ValueError:
                return False  # timestamp malformado vindo do Zoho — descarta
            if created_dt <= since_dt:
                return False
        return True

    filtrados = [t for t in detalhes if passa_filtros(t)]

    # 7. Ordena por ticketNumber decrescente
    filtrados.sort(key=lambda x: int(x.get("ticketNumber", 0)), reverse=True)

    # 8. Enriquece e formata output
    output = []
    for t in filtrados:
        cf = t.get("cf") or {}
        assignee_id = t.get("assigneeId")
        output.append({
            "ticketNumber": t.get("ticketNumber"),
            "subject": t.get("subject"),
            "status": t.get("status"),
            "statusType": t.get("statusType"),
            "createdTime": t.get("createdTime"),
            "classification": t.get("classification"),
            "priority": t.get("priority"),
            "nivel_suporte": cf.get("cf_nivel_de_suporte"),
            "organizacao": cf.get("cf_nome_da_organizacao"),
            "analista": agentes.get(assignee_id, "Não atribuído"),
            "description": strip_html(t.get("description")),
        })

    # 9. Imprime JSON
    print(json.dumps(output, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
