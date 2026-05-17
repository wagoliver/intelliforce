"""Diagnóstico do ambiente — endpoint admin-only.

Roda checks rápidos pra responder: o sistema está pronto pra operar? Onde
provavelmente está o problema? Cada check retorna status (ok/warn/error),
métricas-chave e, se aplicável, uma recomendação acionável.

v0 cobre os 3 sintomas que já causaram travas reais:
  - LM Studio: reachable, token válido, modelo carregado, latência de probe.
  - OpenCode: tamanho estimado do system prompt vs context length configurado.
  - Admins: existe pelo menos 1 admin humano ativo?
"""
from __future__ import annotations

import asyncio
import time
from pathlib import Path

import httpx
import structlog
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from intelliforce.api.deps import get_db, require_admin
from intelliforce.db.models.user import User, UserRole
from intelliforce.settings import get_settings

log = structlog.get_logger()

router = APIRouter(
    prefix="/diagnostics",
    tags=["diagnostics"],
    dependencies=[Depends(require_admin)],
)


# Heurística pra estimar tokens a partir de bytes de texto latino.
_BYTES_PER_TOKEN = 4
# Fração do contexto que precisa sobrar pra resposta + histórico antes de
# considerar o prompt "apertado".
_CTX_HEADROOM_FRACTION = 0.7


class CheckResult(BaseModel):
    name: str
    status: str  # "ok" | "warn" | "error"
    summary: str
    details: dict
    recommendation: str | None = None


class DiagnosticsReport(BaseModel):
    generated_at: float
    checks: list[CheckResult]


async def _check_lm_studio() -> CheckResult:
    settings = get_settings()
    base_url = settings.lmstudio_base_url.rstrip("/")
    api_key = settings.lmstudio_api_key
    default_model = settings.lmstudio_default_model

    details: dict = {
        "base_url": base_url,
        "default_model": default_model,
        "token_configured": bool(api_key),
    }

    if not api_key:
        return CheckResult(
            name="lm_studio",
            status="error",
            summary="API key não configurada",
            details=details,
            recommendation="Defina LMSTUDIO_API_KEY no .env e reinicie a API.",
        )

    # Probe 1 — listar modelos (rápido, valida reachability + token)
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            t0 = time.perf_counter()
            r = await client.get(
                f"{base_url}/models",
                headers={"Authorization": f"Bearer {api_key}"},
            )
            details["list_models_latency_ms"] = round((time.perf_counter() - t0) * 1000)
            details["list_models_status"] = r.status_code

            if r.status_code == 401:
                return CheckResult(
                    name="lm_studio",
                    status="error",
                    summary="Token rejeitado (401)",
                    details=details,
                    recommendation=(
                        "O LM Studio rejeitou o bearer token. Confirme que "
                        "LMSTUDIO_API_KEY no .env bate com o token ativo no LM Studio."
                    ),
                )

            r.raise_for_status()
            payload = r.json()
            models = payload.get("data", []) or []
            model_ids = [m.get("id") for m in models if isinstance(m, dict)]
            details["available_models"] = model_ids
            details["default_model_available"] = default_model in model_ids

            if default_model not in model_ids:
                sample = ", ".join(model_ids[:5]) or "(nenhum)"
                return CheckResult(
                    name="lm_studio",
                    status="error",
                    summary=f"Modelo padrão '{default_model}' não está disponível",
                    details=details,
                    recommendation=(
                        f"Carregue '{default_model}' no LM Studio. "
                        f"Modelos visíveis: {sample}."
                    ),
                )
    except httpx.RequestError as e:
        details["error"] = str(e)
        return CheckResult(
            name="lm_studio",
            status="error",
            summary="LM Studio inacessível",
            details=details,
            recommendation=(
                f"Confirme que o LM Studio está rodando e que "
                f"LMSTUDIO_BASE_URL aponta pra ele. URL atual: {base_url}."
            ),
        )
    except httpx.HTTPStatusError as e:
        details["error"] = f"HTTP {e.response.status_code}"
        return CheckResult(
            name="lm_studio",
            status="error",
            summary=f"LM Studio retornou HTTP {e.response.status_code}",
            details=details,
            recommendation="Veja os logs do LM Studio.",
        )

    # Probe de inferência foi descartado: com reasoning models grandes
    # (qwen3.6-27b) o "ping" pode demorar muito sem produzir token visível,
    # gerando falsos positivos. Listagem + verificação de presença do modelo
    # já cobrem reachability e auth.
    return CheckResult(
        name="lm_studio",
        status="ok",
        summary=(
            f"Reachable, token válido, '{default_model}' carregado "
            f"({details['list_models_latency_ms']}ms na listagem)"
        ),
        details=details,
    )


async def _check_opencode_prompt_size() -> CheckResult:
    settings = get_settings()
    opencode_root = Path(settings.opencode_config_path) / ".opencode"

    details: dict = {"opencode_root": str(opencode_root)}

    if not opencode_root.exists():
        return CheckResult(
            name="opencode",
            status="error",
            summary="Diretório .opencode não encontrado",
            details=details,
            recommendation=(
                f"Esperado em {opencode_root}. Confirme OPENCODE_CONFIG_PATH."
            ),
        )

    agents_dir = opencode_root / "agents"
    skills_dir = opencode_root / "skills"

    skills_total_bytes = 0
    skills_count = 0
    skill_breakdown: list[dict] = []
    if skills_dir.exists():
        for skill_md in sorted(skills_dir.glob("*/SKILL.md")):
            size = skill_md.stat().st_size
            skills_total_bytes += size
            skills_count += 1
            skill_breakdown.append({"name": skill_md.parent.name, "bytes": size})

    agents_info: list[dict] = []
    if agents_dir.exists():
        for agent_md in sorted(agents_dir.glob("*.md")):
            agent_size = agent_md.stat().st_size
            # Estimativa conservadora: agent + TODAS as SKILL.md.
            # Em teoria o OpenCode faz progressive disclosure (só metadado entra
            # no prompt inicial), mas a evidência empírica é que n_keep do LM
            # Studio bate com o tamanho total. Assumimos pior caso pra alertar.
            total_bytes = agent_size + skills_total_bytes
            agents_info.append({
                "name": agent_md.stem,
                "agent_bytes": agent_size,
                "skills_bytes": skills_total_bytes,
                "total_bytes": total_bytes,
                "est_tokens": total_bytes // _BYTES_PER_TOKEN,
            })

    details["agents"] = agents_info
    details["skills_count"] = skills_count
    details["skills_total_bytes"] = skills_total_bytes
    details["skill_breakdown"] = skill_breakdown
    details["context_length_configured"] = settings.lmstudio_context_length

    if not agents_info:
        return CheckResult(
            name="opencode",
            status="warn",
            summary="Nenhum agent encontrado",
            details=details,
            recommendation=f"Esperado em {agents_dir}.",
        )

    worst = max(agents_info, key=lambda a: a["est_tokens"])
    max_tokens = worst["est_tokens"]
    ctx = settings.lmstudio_context_length

    if max_tokens > ctx:
        sugestao = max(32768, max_tokens * 2)
        return CheckResult(
            name="opencode",
            status="error",
            summary=(
                f"Agent '{worst['name']}' estima ~{max_tokens} tokens, "
                f"excede contexto configurado ({ctx})"
            ),
            details=details,
            recommendation=(
                f"Recarregue o modelo com context length ≥ {sugestao}. "
                f"Ex: `lms load {settings.lmstudio_default_model} -c {sugestao} "
                f"--gpu max -y`. Alternativa: reduzir skills ativas no agent."
            ),
        )

    if max_tokens > ctx * _CTX_HEADROOM_FRACTION:
        pct = round(max_tokens / ctx * 100)
        return CheckResult(
            name="opencode",
            status="warn",
            summary=(
                f"Agent '{worst['name']}' usa ~{max_tokens} tokens "
                f"({pct}% do contexto)"
            ),
            details=details,
            recommendation=(
                "Margem apertada — sobra pouco pra resposta/histórico. "
                "Aumente context length ou reduza skills."
            ),
        )

    pct = round(max_tokens / ctx * 100)
    return CheckResult(
        name="opencode",
        status="ok",
        summary=(
            f"{len(agents_info)} agents, {skills_count} skills. "
            f"Maior prompt: ~{max_tokens} tokens ({pct}% de {ctx})"
        ),
        details=details,
    )


async def _check_admin_users(db: AsyncSession) -> CheckResult:
    result = await db.execute(
        select(func.count(User.id)).where(
            User.role == UserRole.ADMIN.value,
            User.is_service.is_(False),
            User.is_active.is_(True),
        )
    )
    count = int(result.scalar() or 0)

    if count == 0:
        return CheckResult(
            name="admins",
            status="error",
            summary="Nenhum admin humano ativo",
            details={"human_admin_count": 0},
            recommendation=(
                "Registre o primeiro admin via POST /auth/register — por design, "
                "o primeiro user humano cadastrado vira admin automaticamente."
            ),
        )

    plural = "s" if count != 1 else ""
    return CheckResult(
        name="admins",
        status="ok",
        summary=f"{count} admin{plural} humano{plural} ativo{plural}",
        details={"human_admin_count": count},
    )


@router.get("", response_model=DiagnosticsReport)
async def get_diagnostics(
    db: AsyncSession = Depends(get_db),
) -> DiagnosticsReport:
    """Roda os 3 checks v0 em paralelo. Admin-only."""
    lm, oc, admins = await asyncio.gather(
        _check_lm_studio(),
        _check_opencode_prompt_size(),
        _check_admin_users(db),
    )
    return DiagnosticsReport(
        generated_at=time.time(),
        checks=[lm, oc, admins],
    )
