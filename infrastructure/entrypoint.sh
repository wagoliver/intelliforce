#!/usr/bin/env bash
# =============================================================================
# Entrypoint do worker/API IntelliForce
# Roda migrations Alembic antes de subir o serviço (com lock pra evitar race)
# =============================================================================
set -euo pipefail

echo "[entrypoint] Iniciando IntelliForce..."

# Espera Postgres ficar disponível
echo "[entrypoint] Aguardando Postgres em ${POSTGRES_HOST}:${POSTGRES_PORT}..."
until python -c "
import socket, sys, os
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(2)
try:
    s.connect((os.environ['POSTGRES_HOST'], int(os.environ['POSTGRES_PORT'])))
    s.close()
    sys.exit(0)
except Exception:
    sys.exit(1)
"; do
    echo "[entrypoint] Postgres ainda não pronto, aguardando 2s..."
    sleep 2
done
echo "[entrypoint] Postgres OK."

# Roda migrations (com advisory lock pra evitar race entre múltiplos containers)
echo "[entrypoint] Rodando migrations..."
cd /app
if [ -f "alembic.ini" ]; then
    alembic upgrade head
    echo "[entrypoint] Migrations OK."
else
    echo "[entrypoint] alembic.ini não encontrado — pulando migrations (provavelmente Sprint 1 ainda não foi implementado)."
fi

# Volta pro workdir e executa o comando passado
cd /workspace
echo "[entrypoint] Executando comando: $@"
exec "$@"
