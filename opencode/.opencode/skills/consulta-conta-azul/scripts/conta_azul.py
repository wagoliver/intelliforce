import subprocess
import sys
import argparse
import json

def get_secret(slug, skill):
    """Busca segredo do Cofre via script do IntelliForce API."""
    result = subprocess.run(
        [
            "python",
            "/opencode-runtime/.opencode/skills/intelliforce-api/scripts/get_secret.py",
            slug,
            "--skill", skill,
        ],
        capture_output=True, text=True, timeout=20,
    )
    if result.returncode != 0:
        print(result.stderr.strip(), file=sys.stderr)
        sys.exit(1)
    return result.stdout.strip()

def buscar_lancamentos(periodo):
    # 1. Buscar token do Cofre
    try:
        token = get_secret("conta-azul-api-token", "consulta-conta-azul")
    except SystemExit:
        print("Erro: Token 'conta-azul-api-token' não encontrado no Cofre.", file=sys.stderr)
        sys.exit(1)

    # 2. Simular chamada API Conta Azul
    # (Em produção, aqui entraria a lógica real de chamada à API REST do Conta Azul)
    print(f"[INFO] Consultando Conta Azul para o período: {periodo}")
    print(f"[INFO] Autenticando com token do Cofre...")

    # Mock de resposta para validação do fluxo
    mock_lancamentos = [
        {
            "lancamento_id": "CA-1001",
            "valor": "1250.00",
            "data_pagamento": "2026-05-10",
            "fornecedor": "Papelaria ABC",
            "status": "pendente"
        },
        {
            "lancamento_id": "CA-1002",
            "valor": "3400.50",
            "data_pagamento": "2026-05-15",
            "fornecedor": "Serviços de TI Ltda",
            "status": "pendente"
        }
    ]

    print(json.dumps(mock_lancamentos, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Consulta lançamentos Conta Azul")
    parser.add_argument("action", choices=["buscar"], help="Ação a executar")
    parser.add_argument("--periodo", default="ultimo-mes", help="Período de busca")
    args = parser.parse_args()

    if args.action == "buscar":
        buscar_lancamentos(args.periodo)
