#!/usr/bin/env bash
# =============================================================================
# Entrypoint do worker/API IntelliForce
# - Prepara runtime do OpenCode (substitui {env:VAR} por valores reais)
# - Roda migrations Alembic antes de subir o serviço (com lock pra evitar race)
# =============================================================================
set -euo pipefail

echo "[entrypoint] Iniciando IntelliForce..."

# -----------------------------------------------------------------------------
# Prepara runtime do OpenCode em /opencode-runtime (writable)
# Copia config do volume read-only e substitui placeholders {env:VAR}
# -----------------------------------------------------------------------------
RUNTIME_DIR=/opencode-runtime
SOURCE_DIR=/workspace/opencode

if [ -d "$SOURCE_DIR" ]; then
    echo "[entrypoint] Preparando runtime OpenCode em $RUNTIME_DIR..."
    rm -rf "$RUNTIME_DIR"
    mkdir -p "$RUNTIME_DIR"
    cp -r "$SOURCE_DIR"/. "$RUNTIME_DIR"/

    # Substitui {env:VAR_NAME} pelos valores reais das variáveis de ambiente
    if [ -f "$RUNTIME_DIR/opencode.json" ]; then
        # Extrai todas as variáveis no formato {env:VAR} e substitui
        for var in $(grep -oE '\{env:[A-Z_]+\}' "$RUNTIME_DIR/opencode.json" | sort -u); do
            var_name=$(echo "$var" | sed 's/{env:\(.*\)}/\1/')
            var_value="${!var_name:-}"
            # Escape pra sed (& \ /)
            escaped=$(printf '%s\n' "$var_value" | sed 's/[\&/]/\\&/g')
            sed -i "s/{env:${var_name}}/${escaped}/g" "$RUNTIME_DIR/opencode.json"
            echo "[entrypoint]   substituído {env:${var_name}}"
        done
    fi

    export OPENCODE_CONFIG_PATH="$RUNTIME_DIR"
    echo "[entrypoint] OpenCode runtime pronto."
else
    echo "[entrypoint] AVISO: $SOURCE_DIR não encontrado — pulando setup do OpenCode."
fi

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
