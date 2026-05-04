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

def buscar_nfs(empresa, periodo):
    # 1. Buscar credenciais do Cofre
    try:
        creds = get_secret("email-arctica-imap", "consulta-email-nf")
    except SystemExit:
        print("Erro: Credenciais 'email-arctica-imap' não encontradas no Cofre.", file=sys.stderr)
        sys.exit(1)

    # 2. Simular conexão IMAP e extração de NFs
    # (Em produção, aqui entraria a lógica real de conexão IMAP e parsing de PDF/Anexos)
    print(f"[INFO] Conectando ao email da {empresa} com credenciais do Cofre...")
    print(f"[INFO] Buscando notas fiscais no período: {periodo}")

    # Mock de resposta para validação do fluxo
    mock_nfs = [
        {
            "nf_id": "NF-2026-04-001",
            "valor": "1250.00",
            "data_emissao": "2026-04-15",
            "fornecedor": "Papelaria ABC",
            "assunto_email": "Nota Fiscal - Pedido #4521"
        },
        {
            "nf_id": "NF-2026-04-002",
            "valor": "3400.50",
            "data_emissao": "2026-04-22",
            "fornecedor": "Serviços de TI Ltda",
            "assunto_email": "NF Eletrônica - Manutenção Servidor"
        }
    ]

    print(json.dumps(mock_nfs, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Consulta NFs via Email")
    parser.add_argument("action", choices=["buscar"], help="Ação a executar")
    parser.add_argument("--empresa", default="Arctica", help="Nome da empresa")
    parser.add_argument("--periodo", default="7d", help="Período de busca (ex: 7d, 30d, 2026-04)")
    args = parser.parse_args()

    if args.action == "buscar":
        buscar_nfs(args.empresa, args.periodo)
