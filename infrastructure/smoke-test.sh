#!/usr/bin/env bash
# =============================================================================
# IntelliForce — smoke test
# =============================================================================
# Roda em container baseado em intelliforce-worker:latest, no compose, depois
# que api+worker ficam healthy. Valida cada peça do stack sem rodar nenhum
# agente real. Custo de LLM: <50 tokens (1 chat completion de 8 max_tokens).
#
# Como pular o teste de LLM (offline ou economia): SMOKE_SKIP_LLM=1
# Como trocar o modelo da prova: SMOKE_LLM_MODEL=qwen/qwen3.6-27b
# =============================================================================
set -u
set -o pipefail

API_BASE="${API_BASE:-http://api:8000}"
LMSTUDIO_URL="${LMSTUDIO_URL:-http://host.docker.internal:1234}"
LMSTUDIO_API_KEY="${LMSTUDIO_API_KEY:-}"
WORKER_TOKEN="${INTELLIFORCE_WORKER_TOKEN:-}"
OPENCODE_DIR="${OPENCODE_DIR:-/workspace/opencode}"
SKIP_LLM="${SMOKE_SKIP_LLM:-0}"
LLM_MODEL="${SMOKE_LLM_MODEL:-qwen2.5-coder-14b-instruct}"

g="\033[0;32m"; r="\033[0;31m"; y="\033[0;33m"; c="\033[0;36m"; b="\033[1m"; n="\033[0m"

PASS=0; FAIL=0; SKIP=0
FAILS=()

ok() { echo -e "  ${g}PASS${n} $1"; PASS=$((PASS+1)); }
ko() { echo -e "  ${r}FAIL${n} $1"; FAIL=$((FAIL+1)); FAILS+=("$1"); [[ -n "${2:-}" ]] && echo "       $(echo "$2" | head -2)"; }
sk() { echo -e "  ${y}SKIP${n} $1 ${y}(${2})${n}"; SKIP=$((SKIP+1)); }
section() { echo; echo -e "${c}${b}── $1 ──${n}"; }

echo -e "${b}IntelliForce smoke test${n} — $(date -u +%FT%TZ)"

# -----------------------------------------------------------------------------
section "Infra interna"

if out=$(python3 -c "
import socket, sys
s = socket.create_connection(('redis', 6379), 3)
s.sendall(b'PING\r\n')
d = s.recv(64)
assert d == b'+PONG\r\n', f'resposta inesperada: {d!r}'
" 2>&1); then
  ok "Redis PING (redis:6379)"
else
  ko "Redis PING" "$out"
fi

if curl -sSf -m 5 "http://clickhouse:8123/ping" >/dev/null 2>&1; then
  ok "ClickHouse /ping (clickhouse:8123)"
else
  ko "ClickHouse /ping" "não respondeu /ping em 5s"
fi

# -----------------------------------------------------------------------------
section "API FastAPI ($API_BASE)"

if out=$(curl -sSf -m 5 "$API_BASE/health" 2>&1); then
  ok "GET /health"
else
  ko "GET /health" "$out"
fi

if out=$(curl -sSf -m 5 "$API_BASE/ready" 2>&1); then
  ok "GET /ready (Postgres conectado)"
else
  ko "GET /ready" "$out"
fi

# -----------------------------------------------------------------------------
section "Auth chain (service account worker-internal)"

if [[ -z "$WORKER_TOKEN" ]]; then
  ko "INTELLIFORCE_WORKER_TOKEN presente" "vazio — verifique .env"
else
  ok "INTELLIFORCE_WORKER_TOKEN presente (len=${#WORKER_TOKEN})"
  if out=$(curl -sSf -m 5 -H "Authorization: Bearer $WORKER_TOKEN" "$API_BASE/agents" 2>&1); then
    n_agents=$(echo "$out" | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d) if isinstance(d,list) else len(d.get('items',d.get('agents',[]))))" 2>/dev/null || echo "?")
    ok "GET /agents com Bearer (count=$n_agents)"
  else
    ko "GET /agents com Bearer" "$out"
  fi
  if out=$(curl -sSf -m 5 -H "Authorization: Bearer $WORKER_TOKEN" "$API_BASE/opencode/tree" 2>&1); then
    counts=$(echo "$out" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f\"skills={len(d.get('skills',[]))} agents={len(d.get('agents',[]))} commands={len(d.get('commands',[]))}\")
" 2>/dev/null || echo "?")
    ok "GET /opencode/tree ($counts)"
  else
    ko "GET /opencode/tree" "$out"
  fi
fi

# -----------------------------------------------------------------------------
section "OpenCode CLI ($OPENCODE_DIR)"

if [[ ! -d "$OPENCODE_DIR" ]]; then
  ko "OpenCode dir montado" "$OPENCODE_DIR não existe no container smoke-test"
elif out=$(cd "$OPENCODE_DIR" && opencode agent list 2>&1); then
  lines=$(echo "$out" | grep -cv '^[[:space:]]*$' || true)
  ok "opencode agent list (${lines} linhas)"
else
  ko "opencode agent list" "$out"
fi

# -----------------------------------------------------------------------------
section "LM Studio ($LMSTUDIO_URL)"

if [[ -z "$LMSTUDIO_API_KEY" ]]; then
  ko "LMSTUDIO_API_KEY presente" "vazio — verifique .env"
  LMS_OK=0
else
  ok "LMSTUDIO_API_KEY presente (len=${#LMSTUDIO_API_KEY})"
  LMS_OK=1
fi

LMS_MODELS_OK=0
if (( LMS_OK == 1 )); then
  if out=$(curl -sSf -m 5 -H "Authorization: Bearer $LMSTUDIO_API_KEY" "$LMSTUDIO_URL/v1/models" 2>&1); then
    n_models=$(echo "$out" | python3 -c "import sys,json;print(len(json.load(sys.stdin)['data']))" 2>/dev/null || echo "?")
    ok "GET /v1/models (models=$n_models)"
    LMS_MODELS_OK=1
  else
    ko "GET /v1/models" "$out"
  fi
fi

# -----------------------------------------------------------------------------
section "LLM round-trip (model=$LLM_MODEL)"

if [[ "$SKIP_LLM" == "1" ]]; then
  sk "POST /v1/chat/completions" "SMOKE_SKIP_LLM=1"
elif (( LMS_MODELS_OK == 0 )); then
  sk "POST /v1/chat/completions" "LM Studio falhou em etapas anteriores"
else
  payload=$(python3 -c "
import json
print(json.dumps({
  'model': '${LLM_MODEL}',
  'messages': [{'role':'user','content':'Reply with exactly one word: ok'}],
  'max_tokens': 8,
  'temperature': 0
}))")
  if out=$(curl -sSf -m 45 -H "Authorization: Bearer $LMSTUDIO_API_KEY" -H "Content-Type: application/json" -d "$payload" "$LMSTUDIO_URL/v1/chat/completions" 2>&1); then
    reply=$(echo "$out" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['choices'][0]['message']['content'].strip()[:60])" 2>/dev/null || echo "?")
    ok "POST /v1/chat/completions → \"$reply\""
  else
    ko "POST /v1/chat/completions" "$out"
  fi
fi

# -----------------------------------------------------------------------------
echo
echo -e "${c}${b}────────────── Resultado ──────────────${n}"
echo -e "  ${g}${PASS} pass${n}  ·  ${r}${FAIL} fail${n}  ·  ${y}${SKIP} skip${n}"
if (( FAIL > 0 )); then
  echo
  echo -e "${r}Falhas:${n}"
  for f in "${FAILS[@]}"; do echo "  - $f"; done
  exit 1
fi
echo -e "${g}✓ smoke test OK${n}"
exit 0
