#!/usr/bin/env bash
# =============================================================================
# IntelliForce — start
# =============================================================================
# Sobe o stack de desenvolvimento (docker compose up -d --build).
#
# Workaround macOS: o Docker Desktop usa o credential helper "desktop", que
# depende do Keychain. Se o Desktop foi iniciado fora de uma sessão GUI
# interativa, o Keychain fica inacessível e o build quebra na resolução de
# metadata de imagens públicas. Para evitar isso, exportamos um DOCKER_CONFIG
# isolado, sem credsStore, válido só para este projeto.
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

export DOCKER_CONFIG="${PROJECT_ROOT}/.docker-config"
mkdir -p "${DOCKER_CONFIG}/cli-plugins"
if [ ! -f "${DOCKER_CONFIG}/config.json" ]; then
  echo '{"auths":{}}' > "${DOCKER_CONFIG}/config.json"
fi

# Repõe os plugins do CLI (compose, buildx, etc.) — sem isso, "docker compose"
# não é reconhecido porque o Docker procura plugins em $DOCKER_CONFIG/cli-plugins/.
if [ -d "${HOME}/.docker/cli-plugins" ]; then
  for plugin in "${HOME}/.docker/cli-plugins/"*; do
    [ -e "${plugin}" ] || continue
    ln -sfn "${plugin}" "${DOCKER_CONFIG}/cli-plugins/$(basename "${plugin}")"
  done
fi

cd "${PROJECT_ROOT}"
docker compose up -d --build "$@"

# -----------------------------------------------------------------------------
# Smoke test: força recriação pra garantir que roda do zero a cada start.
# (sem isso, `compose up` deixa o smoke-test em estado "Exited" entre runs)
# -----------------------------------------------------------------------------
echo
echo "→ Executando smoke test…"
docker compose rm -fs smoke-test >/dev/null 2>&1 || true
docker compose up -d smoke-test >/dev/null

# Aguarda o container exitar (timeout 120s) e imprime o log inteiro.
docker wait intelliforce-smoke-test >/dev/null 2>&1 || true
echo
docker logs intelliforce-smoke-test

EXIT=$(docker inspect intelliforce-smoke-test --format '{{.State.ExitCode}}' 2>/dev/null || echo "1")
if [[ "$EXIT" != "0" ]]; then
  echo
  echo "⚠️  Smoke test falhou (exit=$EXIT). Stack continua rodando — investigue e reexecute."
fi
exit "$EXIT"
