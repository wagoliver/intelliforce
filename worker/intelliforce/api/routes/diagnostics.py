"""Endpoints de diagnóstico para a tela de Configurações & Saúde.

Diferente de /health (liveness/readiness), aqui o foco é diagnóstico humano:
cada componente vem com descrição, métrica focal, e causas prováveis quando
algo falha. UI consome /status no load e /test/{id} no botão "Testar".
"""
from __future__ import annotations

import asyncio
import subprocess
import time
from collections.abc import Awaitable, Callable
from datetime import datetime, timezone

import httpx
import structlog
from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from intelliforce.api.schemas.diagnostics import (
    ComponentId,
    ConfigGuide,
    ConfigGuideStep,
    DiagnosticComponent,
    DiagnosticsStatus,
    DiagnosticsSummary,
    Metric,
)
from intelliforce.db.base import async_session_factory
from intelliforce.settings import Settings, get_settings

router = APIRouter(prefix="/diagnostics", tags=["diagnostics"])
log = structlog.get_logger()

WORKER_HEARTBEAT_KEY = "worker:last_heartbeat"
WORKER_HEALTHY_SECONDS = 30
WORKER_DEGRADED_SECONDS = 90

CHECKER_TIMEOUT_SECONDS = 3.5

# Variáveis críticas mostradas no card "env". Tuple (nome ENV, atributo em Settings).
CRITICAL_ENVS: list[tuple[str, str]] = [
    ("LMSTUDIO_BASE_URL", "lmstudio_base_url"),
    ("LMSTUDIO_DEFAULT_MODEL", "lmstudio_default_model"),
    ("LMSTUDIO_API_KEY", "lmstudio_api_key"),
    ("JWT_SECRET", "jwt_secret"),
    ("VAULT_MASTER_KEY", "vault_master_key"),
    ("ADMIN_PASSWORD", "admin_password"),
    ("WORKER_TOKEN", "worker_token"),
    ("POSTGRES_PASSWORD", "postgres_password"),
    ("CLICKHOUSE_PASSWORD", "clickhouse_password"),
]
PLACEHOLDER_VALUES = {"change-me"}


def _now() -> datetime:
    return datetime.now(timezone.utc)


# =============================================================================
# Checkers — cada um retorna um DiagnosticComponent completo
# =============================================================================

async def check_llm(settings: Settings) -> DiagnosticComponent:
    started = time.monotonic()
    last_check = _now()
    base_url = settings.lmstudio_base_url.rstrip("/")
    url = f"{base_url}/models"
    description = (
        "Provider OpenAI-compatible (LM Studio) servindo o modelo configurado "
        "para os agentes."
    )

    try:
        headers: dict[str, str] = {}
        if settings.lmstudio_api_key:
            headers["Authorization"] = f"Bearer {settings.lmstudio_api_key}"
        async with httpx.AsyncClient(timeout=2.5) as client:
            response = await client.get(url, headers=headers)
        latency_ms = (time.monotonic() - started) * 1000.0

        if response.status_code in (401, 403):
            return DiagnosticComponent(
                id="llm",
                name="LM Studio",
                description=description,
                status="warn",
                metric=Metric(value=f"{latency_ms:.0f}", label="latência", unit="ms"),
                meta=[base_url, f"HTTP {response.status_code}"],
                message="Servidor exige autenticação mas LMSTUDIO_API_KEY está vazia ou incorreta.",
                causes=[
                    "Setar LMSTUDIO_API_KEY no .env (pra LM Studio local, geralmente 'lm-studio')",
                    "Se for OpenAI/Anthropic, usar a API key real do provider",
                ],
                last_check=last_check,
                latency_ms=latency_ms,
            )
        response.raise_for_status()
        payload = response.json()
        models = [
            m.get("id", "") for m in payload.get("data", []) if isinstance(m, dict)
        ]
        expected = settings.lmstudio_default_model
        loaded = expected in models or any(expected in m for m in models)

        if loaded:
            return DiagnosticComponent(
                id="llm",
                name="LM Studio",
                description=description,
                status="ok",
                metric=Metric(value=f"{latency_ms:.0f}", label="latência", unit="ms"),
                meta=[
                    f"modelo: {expected}",
                    f"{len(models)} modelos disponíveis",
                    base_url,
                ],
                last_check=last_check,
                latency_ms=latency_ms,
            )
        return DiagnosticComponent(
            id="llm",
            name="LM Studio",
            description=description,
            status="warn",
            metric=Metric(value=f"{latency_ms:.0f}", label="latência", unit="ms"),
            meta=[
                f"esperado: {expected}",
                f"{len(models)} modelos carregados",
                base_url,
            ],
            message="Servidor respondeu mas o modelo esperado não está carregado.",
            causes=[
                "Carregar o modelo no LM Studio (Models → Load)",
                "Atualizar LMSTUDIO_DEFAULT_MODEL no .env",
            ],
            last_check=last_check,
            latency_ms=latency_ms,
        )
    except (httpx.ConnectError, httpx.ConnectTimeout, httpx.ReadTimeout):
        return DiagnosticComponent(
            id="llm",
            name="LM Studio",
            description=description,
            status="err",
            meta=[base_url, f"modelo esperado: {settings.lmstudio_default_model}"],
            message="Não conseguiu conectar.",
            causes=[
                "LM Studio não está rodando neste computador",
                "lm link pro Mac não está ativo",
                "LMSTUDIO_BASE_URL aponta pra endereço errado no .env",
            ],
            last_check=last_check,
        )
    except Exception as exc:  # noqa: BLE001
        return DiagnosticComponent(
            id="llm",
            name="LM Studio",
            description=description,
            status="err",
            meta=[base_url],
            message=f"Erro ao verificar: {type(exc).__name__}",
            causes=[str(exc)[:200]] if str(exc) else [],
            last_check=last_check,
        )


def _opencode_version_sync() -> tuple[str, str]:
    """Retorna (status, info). status ∈ {ok, err}. info = versão ou mensagem de erro."""
    try:
        result = subprocess.run(
            ["opencode", "--version"],
            capture_output=True,
            timeout=5,
            text=True,
        )
        if result.returncode == 0:
            version = (result.stdout or result.stderr).strip()
            return ("ok", version or "?")
        return ("err", (result.stderr or "exit != 0").strip()[:200])
    except FileNotFoundError:
        return ("err", "binário opencode não encontrado no PATH")
    except subprocess.TimeoutExpired:
        return ("err", "timeout em 5s")
    except Exception as exc:  # noqa: BLE001
        return ("err", f"{type(exc).__name__}: {exc}"[:200])


async def check_opencode(settings: Settings) -> DiagnosticComponent:
    started = time.monotonic()
    last_check = _now()
    description = (
        "Runtime de agentes. Binário standalone embarcado na imagem do worker."
    )
    status, info = await asyncio.to_thread(_opencode_version_sync)
    latency_ms = (time.monotonic() - started) * 1000.0

    if status == "ok":
        return DiagnosticComponent(
            id="opencode",
            name="OpenCode CLI",
            description=description,
            status="ok",
            metric=Metric(value=info, label="versão"),
            meta=[f"config: {settings.opencode_config_path}"],
            last_check=last_check,
            latency_ms=latency_ms,
        )

    return DiagnosticComponent(
        id="opencode",
        name="OpenCode CLI",
        description=description,
        status="err",
        message=f"opencode não respondeu: {info}",
        causes=[
            "Imagem do worker não foi (re)buildada após mudança no Dockerfile",
            "Instalador do OpenCode falhou no build",
        ],
        last_check=last_check,
        latency_ms=latency_ms,
    )


async def check_env(settings: Settings) -> DiagnosticComponent:
    last_check = _now()
    empty: list[str] = []
    placeholder: list[str] = []
    ok_count = 0

    for env_name, attr in CRITICAL_ENVS:
        value = getattr(settings, attr, "")
        if value == "":
            empty.append(env_name)
        elif value in PLACEHOLDER_VALUES:
            placeholder.append(env_name)
        else:
            ok_count += 1

    total = len(CRITICAL_ENVS)
    issues = empty + placeholder

    if not issues:
        status = "ok"
        message: str | None = None
        causes: list[str] = []
    else:
        status = "warn"
        message = f"{len(issues)} variável(is) crítica(s) sem valor real."
        causes = [
            "Variável vazia ou com placeholder 'change-me' no .env",
            "Algumas (WORKER_TOKEN, VAULT_MASTER_KEY) podem ser opcionais em dev",
        ]

    meta: list[str] = []
    if empty:
        meta.append(f"vazias: {', '.join(empty)}")
    if placeholder:
        meta.append(f"placeholder: {', '.join(placeholder)}")
    if not meta:
        meta.append("todas as variáveis críticas configuradas")
    meta.append(".env (volumes do worker)")

    return DiagnosticComponent(
        id="env",
        name="Variáveis de ambiente",
        description="Configuração lida do .env e usada por todos os componentes.",
        status=status,
        metric=Metric(value=str(ok_count), label="setadas", suffix=f"/{total}"),
        meta=meta,
        message=message,
        causes=causes,
        last_check=last_check,
    )


async def check_worker(settings: Settings) -> DiagnosticComponent:
    import redis.asyncio as redis_async

    started = time.monotonic()
    last_check = _now()
    description = (
        "Consumer event-driven que pega tarefas da fila e invoca OpenCode."
    )

    try:
        client = redis_async.from_url(settings.redis_url)
        try:
            raw = await client.get(WORKER_HEARTBEAT_KEY)
        finally:
            await client.aclose()
    except Exception as exc:  # noqa: BLE001
        return DiagnosticComponent(
            id="worker",
            name="Worker",
            description=description,
            status="err",
            message=f"Falha ao consultar Redis: {type(exc).__name__}",
            causes=[str(exc)[:200]] if str(exc) else [],
            last_check=last_check,
        )

    latency_ms = (time.monotonic() - started) * 1000.0

    if raw is None:
        return DiagnosticComponent(
            id="worker",
            name="Worker",
            description=description,
            status="unknown",
            meta=[f"key: {WORKER_HEARTBEAT_KEY}"],
            message="Sem heartbeat registrado. Worker pode estar iniciando.",
            last_check=last_check,
            latency_ms=latency_ms,
        )

    try:
        value = raw.decode() if isinstance(raw, bytes) else str(raw)
        heartbeat_at = datetime.fromisoformat(value)
        if heartbeat_at.tzinfo is None:
            heartbeat_at = heartbeat_at.replace(tzinfo=timezone.utc)
    except Exception:  # noqa: BLE001
        return DiagnosticComponent(
            id="worker",
            name="Worker",
            description=description,
            status="err",
            meta=[f"key: {WORKER_HEARTBEAT_KEY}"],
            message="Heartbeat com formato inválido.",
            last_check=last_check,
            latency_ms=latency_ms,
        )

    delta = max((last_check - heartbeat_at).total_seconds(), 0.0)

    if delta < WORKER_HEALTHY_SECONDS:
        status, message, causes = "ok", None, []
    elif delta < WORKER_DEGRADED_SECONDS:
        status = "warn"
        message = f"Heartbeat antigo ({int(delta)}s). Worker pode estar lento."
        causes = ["Worker sob carga", "Conexão Redis intermitente"]
    else:
        status = "err"
        message = f"Sem heartbeat há {int(delta)}s. Worker provavelmente caiu."
        causes = [
            "Container worker parado ou travado",
            "Loop principal abortou (ver `docker compose logs worker`)",
            "Conexão Redis perdida",
        ]

    return DiagnosticComponent(
        id="worker",
        name="Worker",
        description=description,
        status=status,
        metric=Metric(value=str(int(delta)), label="último heartbeat", unit="s"),
        meta=[f"último: {heartbeat_at.isoformat()}"],
        message=message,
        causes=causes,
        last_check=last_check,
        latency_ms=latency_ms,
    )


async def check_redis(settings: Settings) -> DiagnosticComponent:
    import redis.asyncio as redis_async

    started = time.monotonic()
    last_check = _now()
    description = "Fila de tarefas, cache e event bus (Streams)."

    try:
        client = redis_async.from_url(settings.redis_url)
        try:
            await client.ping()
            info = await client.info("memory")
        finally:
            await client.aclose()
        latency_ms = (time.monotonic() - started) * 1000.0
        used_human = info.get("used_memory_human", "—") if isinstance(info, dict) else "—"
        return DiagnosticComponent(
            id="redis",
            name="Redis",
            description=description,
            status="ok",
            metric=Metric(value=f"{latency_ms:.1f}", label="latência", unit="ms"),
            meta=[
                f"memória {used_human}",
                f"{settings.redis_host}:{settings.redis_port}",
            ],
            last_check=last_check,
            latency_ms=latency_ms,
        )
    except Exception as exc:  # noqa: BLE001
        return DiagnosticComponent(
            id="redis",
            name="Redis",
            description=description,
            status="err",
            meta=[f"{settings.redis_host}:{settings.redis_port}"],
            message=f"Falha ao conectar: {type(exc).__name__}",
            causes=[str(exc)[:200]] if str(exc) else ["Container redis parado"],
            last_check=last_check,
        )


async def check_postgres(settings: Settings) -> DiagnosticComponent:
    started = time.monotonic()
    last_check = _now()
    description = (
        "Estado transacional (tarefas, agentes, auditoria leve) + pgvector."
    )

    try:
        async with async_session_factory() as session:
            version_res = await session.execute(text("SELECT version()"))
            version_str = version_res.scalar() or ""
            try:
                mig_res = await session.execute(
                    text("SELECT version_num FROM alembic_version LIMIT 1")
                )
                migration = mig_res.scalar() or "—"
            except Exception:  # noqa: BLE001
                migration = "—"
        latency_ms = (time.monotonic() - started) * 1000.0

        pg_version = "?"
        if version_str.startswith("PostgreSQL"):
            parts = version_str.split()
            if len(parts) > 1:
                pg_version = parts[1]

        return DiagnosticComponent(
            id="postgres",
            name="Postgres",
            description=description,
            status="ok",
            metric=Metric(value=pg_version, label="versão"),
            meta=[
                f"database: {settings.postgres_db}",
                f"alembic: {migration}",
                f"{settings.postgres_host}:{settings.postgres_port}",
            ],
            last_check=last_check,
            latency_ms=latency_ms,
        )
    except Exception as exc:  # noqa: BLE001
        return DiagnosticComponent(
            id="postgres",
            name="Postgres",
            description=description,
            status="err",
            meta=[f"{settings.postgres_host}:{settings.postgres_port}"],
            message=f"Falha ao conectar: {type(exc).__name__}",
            causes=[str(exc)[:200]] if str(exc) else ["Container postgres parado"],
            last_check=last_check,
        )


def _check_clickhouse_sync() -> tuple[str, str | None, str | None]:
    """Retorna (status, version, error_msg)."""
    try:
        from intelliforce.clickhouse.client import get_client

        client = get_client()
        try:
            version = client.command("SELECT version()")
            return ("ok", str(version), None)
        finally:
            client.close()
    except Exception as exc:  # noqa: BLE001
        return ("err", None, f"{type(exc).__name__}: {exc}"[:200])


async def check_clickhouse(settings: Settings) -> DiagnosticComponent:
    started = time.monotonic()
    last_check = _now()
    description = "Eventos verbosos / append-only (auditoria pesada, métricas)."

    status, version, err = await asyncio.to_thread(_check_clickhouse_sync)
    latency_ms = (time.monotonic() - started) * 1000.0

    if status == "ok":
        return DiagnosticComponent(
            id="clickhouse",
            name="ClickHouse",
            description=description,
            status="ok",
            metric=Metric(value=version or "?", label="versão"),
            meta=[
                f"database: {settings.clickhouse_db}",
                f"{settings.clickhouse_host}:{settings.clickhouse_http_port}",
            ],
            last_check=last_check,
            latency_ms=latency_ms,
        )

    return DiagnosticComponent(
        id="clickhouse",
        name="ClickHouse",
        description=description,
        status="err",
        meta=[f"{settings.clickhouse_host}:{settings.clickhouse_http_port}"],
        message="Falha ao conectar.",
        causes=[err or "Container clickhouse parado"],
        last_check=last_check,
        latency_ms=latency_ms,
    )


# =============================================================================
# Orquestração
# =============================================================================

CheckerFn = Callable[[Settings], Awaitable[DiagnosticComponent]]

CHECKERS: dict[ComponentId, CheckerFn] = {
    "llm": check_llm,
    "opencode": check_opencode,
    "env": check_env,
    "worker": check_worker,
    "redis": check_redis,
    "postgres": check_postgres,
    "clickhouse": check_clickhouse,
}

# Ordem fixa de exibição na UI (pior primeiro só importa pra hero — UI decide)
COMPONENT_ORDER: list[ComponentId] = [
    "llm", "opencode", "env", "worker", "redis", "postgres", "clickhouse",
]


async def _run_checker_safe(
    component_id: ComponentId,
    settings: Settings,
    timeout: float = CHECKER_TIMEOUT_SECONDS,
) -> DiagnosticComponent:
    """Roda um checker com timeout; em falha, devolve componente em estado de erro.

    Também preenche has_guide com base em GUIDES disponíveis — UI usa isso pra
    decidir se mostra botão "Como configurar".
    """
    try:
        result = await asyncio.wait_for(CHECKERS[component_id](settings), timeout=timeout)
    except asyncio.TimeoutError:
        result = DiagnosticComponent(
            id=component_id,
            name=component_id,
            description="—",
            status="err",
            message=f"Checagem excedeu timeout de {timeout}s.",
            last_check=_now(),
        )
    except Exception as exc:  # noqa: BLE001
        log.exception("diagnostics.checker_failed", component=component_id)
        result = DiagnosticComponent(
            id=component_id,
            name=component_id,
            description="—",
            status="err",
            message=f"Erro inesperado: {type(exc).__name__}",
            causes=[str(exc)[:200]] if str(exc) else [],
            last_check=_now(),
        )

    result.has_guide = component_id in GUIDES
    return result


def _summarize(components: list[DiagnosticComponent]) -> DiagnosticsSummary:
    healthy = sum(1 for c in components if c.status == "ok")
    warning = sum(1 for c in components if c.status == "warn")
    error = sum(1 for c in components if c.status == "err")
    unknown = sum(1 for c in components if c.status == "unknown")
    return DiagnosticsSummary(
        healthy=healthy,
        warning=warning,
        error=error,
        unknown=unknown,
        total=len(components),
    )


# =============================================================================
# Guias de configuração (conteúdo humano, pt-BR)
# =============================================================================

GUIDES: dict[ComponentId, ConfigGuide] = {
    "llm": ConfigGuide(
        component_id="llm",
        title="Configurar provider de LLM",
        intro=(
            "O LM Studio é o servidor OpenAI-compatible que hospeda o modelo. "
            "Pode rodar local (neste computador) ou remoto (no Mac via lm link). "
            "Em qualquer caso, configurar provider é mudança de URL + chave no .env "
            "— código de agentes não muda."
        ),
        steps=[
            ConfigGuideStep(
                title="Onde o modelo vai rodar?",
                body=(
                    "Decida entre rodar local (neste computador) ou remoto (em outra "
                    "máquina via lm link). Cada opção tem passos próprios abaixo."
                ),
            ),
            ConfigGuideStep(
                title="Opção A — Local",
                body=(
                    "Abrir LM Studio neste computador. Em Models → Load, carregar o "
                    "modelo desejado (ex.: qwen2.5-coder:32b). Depois em Developer "
                    "→ Start Server. A porta padrão é 1234."
                ),
            ),
            ConfigGuideStep(
                title="Opção B — Remoto via lm link",
                body=(
                    "No computador onde o LM Studio roda (ex.: Mac), rodar no "
                    "terminal o comando abaixo. Ele expõe o servidor pra outras máquinas."
                ),
                snippet="lm link",
            ),
            ConfigGuideStep(
                title="Pegar a API key",
                body=(
                    "Versões recentes do LM Studio exigem autenticação. Em Developer "
                    "→ Server Settings, copiar o campo 'Server API Key' (ou setar um "
                    "valor seu). Para LM Studio local, qualquer string serve — o padrão "
                    "do projeto é 'lm-studio'."
                ),
            ),
            ConfigGuideStep(
                title="Atualizar .env",
                body=(
                    "Na raiz do projeto, ajustar (ou criar) as variáveis abaixo. "
                    "Se for remoto, substituir a URL pela do lm link."
                ),
                snippet=(
                    "LMSTUDIO_BASE_URL=http://host.docker.internal:1234/v1\n"
                    "LMSTUDIO_DEFAULT_MODEL=qwen/qwen3.6-27b\n"
                    "LMSTUDIO_API_KEY=lm-studio"
                ),
            ),
            ConfigGuideStep(
                title="Reiniciar a stack",
                body=(
                    "Worker e API leem o .env no startup — reiniciar pra carregar as "
                    "variáveis novas."
                ),
                snippet="docker compose restart worker api",
            ),
        ],
        footer_note=(
            "Trocar de LM Studio pra outro provider (vLLM, llama-server, OpenAI) é "
            "só mudar a URL acima — o IntelliForce usa abstração OpenAI-compatible."
        ),
    ),
    "env": ConfigGuide(
        component_id="env",
        title="Configurar variáveis de ambiente",
        intro=(
            "Variáveis críticas vivem no arquivo .env na raiz do projeto. Algumas "
            "vêm com placeholder 'change-me' que precisa ser substituído por valor "
            "real em qualquer ambiente que não seja dev local."
        ),
        steps=[
            ConfigGuideStep(
                title="Localizar o arquivo .env",
                body=(
                    "Na raiz do projeto (ao lado do docker-compose.yml). Se não existir, "
                    "copiar a partir do .env.example com 'cp .env.example .env'."
                ),
            ),
            ConfigGuideStep(
                title="Gerar JWT_SECRET",
                body=(
                    "Segredo aleatório que assina tokens de autenticação. Nunca deixar "
                    "como 'change-me' em produção. Gerar com:"
                ),
                snippet="python -c \"import secrets; print(secrets.token_urlsafe(48))\"",
            ),
            ConfigGuideStep(
                title="Gerar VAULT_MASTER_KEY",
                body=(
                    "Chave Fernet usada pra criptografar secrets guardados no Vault "
                    "(integrations, API keys de provider, etc.). Gerar com:"
                ),
                snippet=(
                    "python -c \"from cryptography.fernet import Fernet; "
                    "print(Fernet.generate_key().decode())\""
                ),
            ),
            ConfigGuideStep(
                title="Gerar WORKER_TOKEN",
                body=(
                    "Token longo (TTL ~365 dias) que o worker usa pra autenticar contra "
                    "a própria API em scheduled tasks. Sem isso, agendas que chamam a "
                    "API falham com TOKEN_EMPTY."
                ),
                snippet="docker compose exec worker python -m intelliforce.scripts.gen_worker_token",
            ),
            ConfigGuideStep(
                title="Recarregar a configuração",
                body="Reiniciar containers que leem o .env:",
                snippet="docker compose restart worker api",
            ),
        ],
        footer_note=(
            "Esta tela mostra apenas o nome das variáveis — valores nunca são expostos. "
            "Veja o arquivo .env diretamente pra inspecionar."
        ),
    ),
}


@router.get("/guide/{component_id}", response_model=ConfigGuide)
async def get_guide(component_id: ComponentId) -> ConfigGuide:
    """Retorna o guia de configuração de um componente, se houver."""
    guide = GUIDES.get(component_id)
    if guide is None:
        raise HTTPException(
            status_code=404,
            detail=f"Guia não disponível para o componente '{component_id}'.",
        )
    return guide


@router.get("/status", response_model=DiagnosticsStatus)
async def get_status() -> DiagnosticsStatus:
    """Estado de todos os componentes (executados em paralelo)."""
    settings = get_settings()
    results = await asyncio.gather(
        *(_run_checker_safe(cid, settings) for cid in COMPONENT_ORDER)
    )
    return DiagnosticsStatus(
        summary=_summarize(results),
        last_check=_now(),
        components=list(results),
    )


@router.post("/test/{component_id}", response_model=DiagnosticComponent)
async def test_component(component_id: ComponentId) -> DiagnosticComponent:
    """Força re-check de um componente específico."""
    if component_id not in CHECKERS:
        raise HTTPException(
            status_code=404, detail=f"Componente desconhecido: {component_id}"
        )
    return await _run_checker_safe(component_id, get_settings())
