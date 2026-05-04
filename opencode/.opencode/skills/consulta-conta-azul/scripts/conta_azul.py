import subprocess
import sys
import argparse
import json
import httpx

def get_secret(slug, skill):
    """Busca segredo do Cofre via script do IntelliForce API."""
    result = subprocess.run(
        [
            "python",
            "/opencode-runtime/.opencode/skills/intelliforce-vault/scripts/vault.py",
            "get",
            slug,
            "--skill", skill,
        ],
        capture_output=True, text=True, timeout=20,
    )
    if result.returncode != 0:
        print(result.stderr.strip(), file=sys.stderr)
        sys.exit(1)
    return result.stdout.strip()

def call_conta_azul(endpoint, token):
    """Chama a API real do Conta Azul."""
    base_url = "https://api.contaazul.com/v1"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    try:
        resp = httpx.get(
            f"{base_url}{endpoint}",
            headers=headers,
            timeout=30,
        )
        if resp.status_code == 401:
            print("TOKEN_EXPIRED_OR_INVALID", file=sys.stderr)
            sys.exit(1)
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as e:
        print(f"API_ERROR_{e.response.status_code}", file=sys.stderr)
        sys.exit(1)
    except httpx.RequestError as e:
        print(f"NETWORK_ERROR: {e}", file=sys.stderr)
        sys.exit(1)

def buscar_lancamentos(periodo):
    # 1. Buscar token do Cofre
    try:
        token = get_secret("conta-azul-api-token", "consulta-conta-azul")
    except SystemExit:
        print("Erro: Token 'conta-azul-api-token' não encontrado no Cofre.", file=sys.stderr)
        sys.exit(1)

    # 2. Chamar API real do Conta Azul
    print(f"[INFO] Consultando Conta Azul para o período: {periodo}")
    print("[INFO] Autenticando com token do Cofre...")

    try:
        data = call_conta_azul("/bills", token)
        print(json.dumps(data, indent=2, ensure_ascii=False))
    except SystemExit:
        raise
    except Exception as e:
        print(f"ERRO: {e}", file=sys.stderr)
        sys.exit(1)

def listar_pagamentos_realizados():
    # 1. Buscar token do Cofre
    try:
        token = get_secret("conta-azul-api-token", "consulta-conta-azul")
    except SystemExit:
        print("Erro: Token 'conta-azul-api-token' não encontrado no Cofre.", file=sys.stderr)
        sys.exit(1)

    # 2. Chamar API real do Conta Azul - pagamentos realizados
    print("[INFO] Consultando pagamentos realizados no Conta Azul...")
    print("[INFO] Autenticando com token do Cofre...")

    try:
        data = call_conta_azul("/payments", token)
        print(json.dumps(data, indent=2, ensure_ascii=False))
    except SystemExit:
        raise
    except Exception as e:
        print(f"ERRO: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Consulta lançamentos Conta Azul")
    parser.add_argument("action", choices=["buscar", "pagamentos-realizados"], help="Ação a executar")
    parser.add_argument("--periodo", default="ultimo-mes", help="Período de busca")
    args = parser.parse_args()

    if args.action == "buscar":
        buscar_lancamentos(args.periodo)
    elif args.action == "pagamentos-realizados":
        listar_pagamentos_realizados()
