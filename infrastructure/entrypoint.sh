#!/usr/bin/env bash
# =============================================================================
# Entrypoint do worker/API IntelliForce
# - Prepara runtime do OpenCode (substitui {env:VAR} por valores reais)
# - Roda migrations Alembic antes de subir o serviço (com lock pra evitar race)
# =============================================================================
set -euo pipefail

echo "[entrypoint] Iniciando IntelliForce..."

# -----------------------------------------------------------------------------
# Prepara runtime do OpenCode em /opencode-runtime
#
# Estratégia (após mover o mount de :ro pra writable):
#   - opencode.json   → COPIADO em runtime (precisa de env substitution sem
#                       poluir o arquivo do host com secrets)
#   - .opencode/      → SYMLINK pro mount writable (agents/skills/commands
#                       criados pelo builder agent persistem no host repo)
#
# Resultado: skills criadas via chat sobrevivem a `docker compose up --build`.
# -----------------------------------------------------------------------------
RUNTIME_DIR=/opencode-runtime
SOURCE_DIR=/workspace/opencode

if [ -d "$SOURCE_DIR" ]; then
    echo "[entrypoint] Preparando runtime OpenCode em $RUNTIME_DIR..."
    rm -rf "$RUNTIME_DIR"
    mkdir -p "$RUNTIME_DIR"

    # Copia apenas opencode.json (writable em runtime, recebe env substitution)
    if [ -f "$SOURCE_DIR/opencode.json" ]; then
        cp "$SOURCE_DIR/opencode.json" "$RUNTIME_DIR/opencode.json"
    fi

    # Symlink da pasta .opencode (agents/skills/commands) → mount writable.
    # OpenCode CLI lê e escreve aqui; tudo que for escrito persiste no host.
    if [ -d "$SOURCE_DIR/.opencode" ]; then
        ln -sfn "$SOURCE_DIR/.opencode" "$RUNTIME_DIR/.opencode"
    fi

    # Substitui {env:VAR_NAME} pelos valores reais das variáveis de ambiente
    # (só no opencode.json runtime — não no arquivo do host).
    if [ -f "$RUNTIME_DIR/opencode.json" ]; then
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
    echo "[entrypoint] OpenCode runtime pronto (skills persistem em $SOURCE_DIR/.opencode)."

    # -------------------------------------------------------------------------
    # System seeds — restauração obrigatória em todo startup
    #
    # Lista de arquivos imutáveis que ficam baked-in na imagem (Dockerfile)
    # e são sempre reaplicados ao mount writable. Mesmo que o user (ou o
    # builder agent) delete ou modifique, no próximo `up` voltam ao canônico.
    #
    # Pra atualizar um seed: editar o arquivo no repo e rodar --build.
    # -------------------------------------------------------------------------
    SEED_DIR=/opencode-seed
    TARGET_OPENCODE="$SOURCE_DIR/.opencode"

    # Lista de seeds (path relativo a $SEED_DIR e $TARGET_OPENCODE).
    # File ou diretório, ambos suportados. Adicionar novos seeds = nova linha aqui
    # E nova linha no Dockerfile.worker (COPY).
    SEEDS=(
        "agents/builder.md"
        "agents/operator.md"
        "skills/karpathy-guidelines"
        "skills/intelliforce-api"
        "skills/intelliforce-discover"
        "skills/intelliforce-departments"
        "skills/intelliforce-squads"
        "skills/intelliforce-activities"
        "skills/intelliforce-agents"
        "skills/intelliforce-instances"
        "skills/intelliforce-tasks"
        "skills/intelliforce-approvals"
        "skills/intelliforce-audit"
        "skills/intelliforce-metrics"
    )

    if [ -d "$SEED_DIR" ] && [ -d "$TARGET_OPENCODE" ]; then
        echo "[entrypoint] Aplicando system seeds (imutáveis)..."
        for seed in "${SEEDS[@]}"; do
            src="$SEED_DIR/$seed"
            dst="$TARGET_OPENCODE/$seed"
            if [ -d "$src" ]; then
                mkdir -p "$dst"
                cp -rf "$src/." "$dst/"
                echo "[entrypoint]   ✓ $seed/ (recursive)"
            elif [ -f "$src" ]; then
                mkdir -p "$(dirname "$dst")"
                cp -f "$src" "$dst"
                echo "[entrypoint]   ✓ $seed"
            else
                echo "[entrypoint]   ⚠ seed ausente no SEED_DIR: $seed"
            fi
        done
    else
        echo "[entrypoint] AVISO: seeds não aplicados (SEED_DIR=$SEED_DIR, TARGET=$TARGET_OPENCODE)"
    fi
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

# Roda migrations Alembic (com advisory lock pra evitar race entre containers)
echo "[entrypoint] Rodando migrations Postgres (Alembic)..."
cd /app
if [ -f "alembic.ini" ]; then
    alembic upgrade head
    echo "[entrypoint] Migrations Postgres OK."
else
    echo "[entrypoint] alembic.ini não encontrado — pulando migrations Postgres."
fi

# Aplica schema ClickHouse (idempotente — CREATE IF NOT EXISTS)
echo "[entrypoint] Aplicando schema ClickHouse..."
if python -c "from intelliforce.clickhouse.client import apply_schema; apply_schema()" 2>&1; then
    echo "[entrypoint] Schema ClickHouse OK."
else
    echo "[entrypoint] AVISO: falha ao aplicar schema ClickHouse — continuando assim mesmo."
fi

# Volta pro workdir e executa o comando passado
cd /workspace
echo "[entrypoint] Executando comando: $@"
exec "$@"
