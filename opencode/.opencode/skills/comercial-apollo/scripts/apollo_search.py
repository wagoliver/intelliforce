#!/usr/bin/env python3
"""
Comercial Apollo — pesquisa empresas no Apollo.io e sugere abordagens comerciais.

Busca credenciais no Vault, consulta REST API do Apollo (mixed_companies/search),
filtra empresas brasileiras pelo perfil SMALL/MID/LARGE e retorna JSON estruturado.

Uso:
  python apollo_search.py
  python apollo_search.py --limit 5 --industry "Technology"
  python apollo_search.py --profile SMALL --state "Sao Paulo" --with-approach
"""
import argparse
import json
import subprocess
import sys

import httpx

# ──────────────────────────────────────────
# Configuracoes estaticas
# ──────────────────────────────────────────
APOLLO_BASE = "https://api.apollo.io/v1"
APOLLO_SEARCH = f"{APOLLO_BASE}/mixed_companies/search"
VAULT_SCRIPT = "/opencode-runtime/.opencode/skills/intelliforce-vault/scripts/vault.py"
SKILL_SLUG = "comercial-apollo"

# Faixas de empregados por perfil (formato Apollo: "min,max")
PROFILES = {
    "SMALL": {"ranges": ["1,10", "11,50", "51,200"], "label": "1-200"},
    "MID":   {"ranges": ["201,500", "501,1000"], "label": "201-1000"},
    "LARGE": {"ranges": ["1001,5000", "5001,10000", "10001,50000"], "label": "1001+"},
}

# ──────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────
def get_vault_api_key() -> str:
    """Busca a API key do Apollo no Vault. Sai com erro se falhar."""
    result = subprocess.run(
        [
            "python", VAULT_SCRIPT, "get", "apollo",
            "--skill", SKILL_SLUG,
        ],
        capture_output=True, text=True, timeout=20,
    )
    if result.returncode != 0:
        print(
            f"Erro ao buscar credencial 'apollo' no Vault: {result.stderr.strip()}",
            file=sys.stderr,
        )
        sys.exit(1)
    return result.stdout.strip()


def build_params(
    limit: int,
    industry: str | None,
    state: str | None,
    profile: str,
) -> dict:
    """Construi os query params pra chamada REST do Apollo."""
    profile_cfg = PROFILES.get(profile, PROFILES["SMALL"])

    params = {
        "per_page": min(limit, 100),
        "page": 1,
        "organization_locations[]": "Brazil",
    }

    # Faixa de empregados — Apollo espera ranges como valores separados
    params["organization_num_employees_ranges[]"] = profile_cfg["ranges"]

    if industry:
        params["q_organization_keyword_tags[]"] = [industry]

    if state:
        # Apollo aceita cidade/estado no mesmo campo de localizacao
        # Adiciona como valor extra na lista
        locs = ["Brazil", state]
        params["organization_locations[]"] = locs

    return params


def query_apollo(api_key: str, params: dict) -> list:
    """Consulta a API REST do Apollo e retorna lista de accounts."""
    headers = {
        "Accept": "application/json",
        "X-Api-Key": api_key,
    }

    try:
        resp = httpx.post(
            APOLLO_SEARCH,
            headers=headers,
            params=params,
            timeout=30,
        )
    except httpx.HTTPError as e:
        print(f"Erro de conexao com Apollo: {e}", file=sys.stderr)
        sys.exit(1)

    if resp.status_code != 200:
        print(
            f"Apollo retornou {resp.status_code}: {resp.text[:500]}",
            file=sys.stderr,
        )
        sys.exit(1)

    data = resp.json()
    accounts = data.get("accounts", [])
    return accounts


def flatten_company(c: dict) -> dict:
    """Mapeia campos do Apollo account pro output padrao."""
    revenue = c.get("organization_revenue_printed") or c.get("organization_revenue")
    return {
        "id": c.get("id"),
        "name": c.get("name"),
        "website": c.get("website_url"),
        "city": c.get("city") or c.get("organization_city"),
        "state": c.get("state") or c.get("organization_state"),
        "country": c.get("country") or c.get("organization_country"),
        "annual_revenue": revenue,
        "primary_domain": c.get("primary_domain"),
        "founded_year": c.get("founded_year"),
        "num_contacts": c.get("num_contacts"),
        "linkedin_url": c.get("linkedin_url"),
        "facebook_url": c.get("facebook_url"),
        "twitter_url": c.get("twitter_url"),
        "languages": c.get("languages", []),
        "sic_codes": c.get("sic_codes", []),
    }


def build_approach(company: dict) -> str:
    """Gera sugestao de abordagem comercial pro xOne baseada nos dados da empresa."""
    name = company.get("name") or "a empresa"
    city = company.get("city") or ""
    state = company.get("state") or ""
    revenue = company.get("annual_revenue") or ""
    domain = company.get("primary_domain") or ""
    founded = company.get("founded_year") or ""
    contacts = company.get("num_contacts") or 0
    location = f" ({city}, {state})" if city and state else ""

    # Classifica porte baseado na receita
    if isinstance(revenue, (int, float)):
        rev_str = str(revenue)
    else:
        rev_str = str(revenue)

    approach = (
        f"Abordagem para {name}{location}:\n"
        f"  Domain: {domain} | Fundada: {founded} | Receita: {rev_str}\n"
        f"  Contatos disponiveis no Apollo: {contacts}\n"
        f"  Angulo: Dores operacionais em empresas de porte medio —\n"
        f"  automatizacao de processos, reducao de custos com suporte e\n"
        f"  escalabilidade do xOne como plataforma SaaS.\n"
        f"  Canal sugerido: LinkedIn InMail pro decisor tecnico (CTO/Head de TI)\n"
        f"  ou email direto pro CEO.\n"
        f"  Pitch: 'Empresas do seu porte estao usando o xOne pra reduzir\n"
        f"  em ~25-30% o tempo de resolucao de chamados operacionais.\n"
        f"  Posso mostrar um demo em 15 min?'"
    )
    return approach


def format_output(companies: list, with_approach: bool) -> list:
    """Formata empresas pro output final."""
    output = []
    for c in companies:
        entry = flatten_company(c)
        if with_approach:
            entry["approach"] = build_approach(entry)
        output.append(entry)
    return output


# ──────────────────────────────────────────
# Main
# ──────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="Vendedor virtual — pesquisa empresas no Apollo.io pro xOne.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=3,
        help="Quantidade de empresas a retornar (default: 3)",
    )
    parser.add_argument(
        "--industry",
        default=None,
        help="Filtro por setor (ex: Technology, Healthcare)",
    )
    parser.add_argument(
        "--state",
        default=None,
        help="Filtro por estado/cidade brasileira (ex: Sao Paulo)",
    )
    parser.add_argument(
        "--profile",
        default="SMALL",
        choices=["SMALL", "MID", "LARGE"],
        help="Perfil de empresa (default: SMALL = ate 200 funcionarios)",
    )
    parser.add_argument(
        "--with-approach",
        action="store_true",
        help="Incluir sugestao de abordagem comercial",
    )
    args = parser.parse_args()

    # 1. API key do Vault
    api_key = get_vault_api_key()

    # 2. Construir params
    params = build_params(args.limit, args.industry, args.state, args.profile)

    # 3. Consultar Apollo
    accounts = query_apollo(api_key, params)

    if not accounts:
        print("Nenhuma empresa encontrada com os filtros informados.", file=sys.stderr)
        print(json.dumps([], indent=2))
        return

    # 4. Formatar e imprimir
    output = format_output(accounts, args.with_approach)
    print(json.dumps(output, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
