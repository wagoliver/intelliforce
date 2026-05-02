#!/usr/bin/env bash
# =============================================================================
# IntelliForce — Bootstrap inicial
# =============================================================================
# Cria .env a partir do .env.example, gera secrets aleatórios e valida pré-reqs.
# Uso: ./scripts/bootstrap.sh
# =============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> IntelliForce — Bootstrap inicial"
echo

# -----------------------------------------------------------------------------
# Pré-requisitos
# -----------------------------------------------------------------------------
echo "==> Validando pré-requisitos..."

if ! command -v docker >/dev/null 2>&1; then
    echo "[ERRO] Docker não encontrado. Instale: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
    echo "[ERRO] Docker Compose v2 não encontrado. Atualize seu Docker."
    exit 1
fi

echo "[OK] Docker e Docker Compose presentes."
echo

# -----------------------------------------------------------------------------
# .env
# -----------------------------------------------------------------------------
if [ -f ".env" ]; then
    echo "==> .env já existe — não vou sobrescrever. Pulando."
else
    echo "==> Criando .env a partir de .env.example..."
    cp .env.example .env

    # Gerar JWT_SECRET aleatório (64 chars)
    if command -v openssl >/dev/null 2>&1; then
        JWT=$(openssl rand -hex 32)
        # Substitui in-place (compatível com macOS e Linux)
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|JWT_SECRET=change-me-with-bootstrap-script-it-generates-random|JWT_SECRET=${JWT}|" .env
        else
            sed -i "s|JWT_SECRET=change-me-with-bootstrap-script-it-generates-random|JWT_SECRET=${JWT}|" .env
        fi
        echo "[OK] JWT_SECRET gerado (64 chars hex)."
    else
        echo "[AVISO] openssl não encontrado — JWT_SECRET ficou com placeholder. Substitua manualmente."
    fi

    # Gerar senha admin se vazia
    if command -v openssl >/dev/null 2>&1; then
        ADMIN_PWD=$(openssl rand -base64 16 | tr -d '=+/' | cut -c1-20)
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|ADMIN_PASSWORD=|ADMIN_PASSWORD=${ADMIN_PWD}|" .env
        else
            sed -i "s|ADMIN_PASSWORD=|ADMIN_PASSWORD=${ADMIN_PWD}|" .env
        fi
        echo "[OK] ADMIN_PASSWORD gerado: ${ADMIN_PWD}"
        echo "    >>> ANOTE essa senha! Será o login inicial do admin."
    fi

    echo "[OK] .env criado."
fi

echo

# -----------------------------------------------------------------------------
# Validação LM Studio
# -----------------------------------------------------------------------------
echo "==> Validando LM Studio..."
LMSTUDIO_HOST_URL="http://127.0.0.1:1234/v1/models"
if curl -s --max-time 3 "$LMSTUDIO_HOST_URL" >/dev/null 2>&1; then
    echo "[OK] LM Studio respondendo em ${LMSTUDIO_HOST_URL}"
else
    echo "[AVISO] LM Studio NÃO respondendo em ${LMSTUDIO_HOST_URL}"
    echo "        Suba o LM Studio com 'Serve on Local Network' antes de docker compose up."
fi

echo
echo "==> Bootstrap concluído."
echo
echo "Próximos passos:"
echo "  1. Revise o .env (ajuste se necessário)"
echo "  2. docker compose up -d --build"
echo "  3. docker compose logs -f worker"
echo
