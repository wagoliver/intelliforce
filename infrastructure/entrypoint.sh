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

    # Defaults dos parâmetros de LLM.
    #
    # O opencode.json referencia {env:LMSTUDIO_*} inclusive em posições onde
    # valor vazio geraria JSON inválido (chave do registro de modelos e os
    # numéricos max_tokens/context_length). Sem default, um .env incompleto
    # derrubaria o container com erro de parse em vez de mensagem útil.
    #
    # Estes são fallback de último recurso — o .env é a fonte da verdade.
    : "${LMSTUDIO_DEFAULT_MODEL:=qwen3.6-27b-mtp}"
    : "${LMSTUDIO_MAX_TOKENS:=8192}"
    : "${LMSTUDIO_CONTEXT_LENGTH:=32768}"
    : "${LMSTUDIO_BASE_URL:=http://host.docker.internal:1234/v1}"
    export LMSTUDIO_DEFAULT_MODEL LMSTUDIO_MAX_TOKENS LMSTUDIO_CONTEXT_LENGTH LMSTUDIO_BASE_URL

    # max_tokens (teto de saída) precisa caber na janela de contexto. Se o
    # .env vier invertido, o LM Studio só reclama na primeira execução real —
    # avisar aqui economiza uma sessão de debug.
    if [ "$LMSTUDIO_MAX_TOKENS" -gt "$LMSTUDIO_CONTEXT_LENGTH" ] 2>/dev/null; then
        echo "[entrypoint] ⚠ LMSTUDIO_MAX_TOKENS ($LMSTUDIO_MAX_TOKENS) > LMSTUDIO_CONTEXT_LENGTH ($LMSTUDIO_CONTEXT_LENGTH)."
        echo "[entrypoint]   max_tokens é o teto de SAÍDA e cabe dentro do contexto. Revise o .env."
    fi

    echo "[entrypoint] Modelo LLM (via .env): $LMSTUDIO_DEFAULT_MODEL"

    # Substitui {env:VAR_NAME} pelos valores reais das variáveis de ambiente
    # (só no opencode.json runtime — não no arquivo do host).
    #
    # Feito em Python, não sed: valores com "/" (LMSTUDIO_BASE_URL) ou "&"
    # corrompem o replacement do sed, que interpreta esses caracteres. Aqui a
    # substituição é literal via str.replace e o JSON é validado no fim, então
    # config quebrada falha aqui com mensagem clara em vez de virar erro
    # obscuro do OpenCode CLI na primeira execução.
    if [ -f "$RUNTIME_DIR/opencode.json" ]; then
        python - "$RUNTIME_DIR/opencode.json" <<'PYEOF'
import json
import os
import re
import sys

path = sys.argv[1]
with open(path, encoding="utf-8") as fh:
    content = fh.read()

missing = []
for var_name in sorted(set(re.findall(r"\{env:([A-Z_]+)\}", content))):
    value = os.environ.get(var_name)
    if value is None or value == "":
        missing.append(var_name)
        continue
    content = content.replace("{env:%s}" % var_name, value)
    # Mascara só segredos de verdade — LMSTUDIO_MAX_TOKENS não é segredo e
    # ver o valor no log ajuda a diagnosticar config errada.
    secret = var_name.endswith(("_KEY", "_SECRET", "_TOKEN", "_PASSWORD"))
    shown = "***" if secret else value
    print("[entrypoint]   substituído {env:%s} -> %s" % (var_name, shown))

if missing:
    print("[entrypoint] ❌ variáveis ausentes/vazias no .env: %s" % ", ".join(missing))
    sys.exit(1)

try:
    json.loads(content)
except json.JSONDecodeError as e:
    print("[entrypoint] ❌ opencode.json inválido após substituição: %s" % e)
    print("[entrypoint]    Confira aspas e valores numéricos no .env.")
    sys.exit(1)

with open(path, "w", encoding="utf-8") as fh:
    fh.write(content)
PYEOF
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
        "skills/intelliforce-vault"
        "skills/intelliforce-teams"
        "skills/intelliforce-reports"
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

    # -------------------------------------------------------------------------
    # Validação da config OpenCode (fail-fast)
    #
    # Roda `opencode agent list` que carrega TODA a config (opencode.json +
    # agents/skills/commands frontmatter) e falha com mensagem clara se algum
    # arquivo estiver malformado. Sem isso, agente quebrado faz o chat parar
    # silenciosamente — só descobrimos rodando comando manualmente no container.
    #
    # Pra desabilitar (raro): export OPENCODE_VALIDATE_ON_START=false
    # -------------------------------------------------------------------------
    if [ "${OPENCODE_VALIDATE_ON_START:-true}" = "true" ] && command -v opencode >/dev/null 2>&1; then
        echo "[entrypoint] Validando config OpenCode..."
        if ! opencode_err=$(cd "$RUNTIME_DIR" && opencode agent list 2>&1 >/dev/null); then
            echo "[entrypoint] ❌ CONFIG OPENCODE INVÁLIDA — container não vai subir."
            echo "[entrypoint] -----------------------------------------------------"
            echo "$opencode_err" | tail -30
            echo "[entrypoint] -----------------------------------------------------"
            echo "[entrypoint] Corrija o(s) arquivo(s) acima em opencode/.opencode/"
            echo "[entrypoint] e reinicie o container. (Pra pular esta verificação:"
            echo "[entrypoint]  export OPENCODE_VALIDATE_ON_START=false)"
            exit 1
        fi
        echo "[entrypoint] ✓ Config OpenCode válida"
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
