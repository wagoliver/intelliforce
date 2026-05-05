"""Busca global — varre departments, agents, activities (Postgres) e
skills (filesystem opencode). Retorna grouped pra UI mostrar dropdown
agrupado por categoria.

Implementação simples (não requer Elasticsearch): ILIKE no Postgres +
fnmatch/in no filesystem. Suficiente pra catálogo do MVP (poucas
centenas de itens cada categoria).
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import structlog
from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from intelliforce.api.deps import get_current_user, get_db
from intelliforce.db.models.activity import Activity
from intelliforce.db.models.agent import Agent
from intelliforce.db.models.department import Department
from intelliforce.db.models.user import User
from intelliforce.settings import get_settings

router = APIRouter(prefix="/search", tags=["search"])
log = structlog.get_logger()


def _highlight_match(text: str, query: str, max_len: int = 120) -> str:
    """Retorna `text` truncado em max_len, priorizando substring que casa
    com query. Retorna texto vazio se text é None/vazio."""
    if not text:
        return ""
    if len(text) <= max_len:
        return text
    # Encontra primeira ocorrência case-insensitive
    lower = text.lower()
    q = query.lower()
    idx = lower.find(q)
    if idx == -1:
        return text[:max_len] + "…"
    # Recorta janela ao redor do match
    start = max(0, idx - 30)
    end = min(len(text), start + max_len)
    snippet = text[start:end]
    if start > 0:
        snippet = "…" + snippet
    if end < len(text):
        snippet = snippet + "…"
    return snippet


async def _search_departments(
    db: AsyncSession, query: str, limit: int
) -> list[dict[str, Any]]:
    pattern = f"%{query}%"
    stmt = (
        select(Department)
        .where(
            or_(
                Department.display_name.ilike(pattern),
                Department.name.ilike(pattern),
                Department.objective.ilike(pattern),
            )
        )
        .order_by(Department.display_name)
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [
        {
            "id": str(d.id),
            "title": d.display_name,
            "subtitle": _highlight_match(d.objective or "", query),
            "slug": d.name,
            "url": "/dashboard",
        }
        for d in rows
    ]


async def _search_agents(
    db: AsyncSession, query: str, limit: int
) -> list[dict[str, Any]]:
    pattern = f"%{query}%"
    stmt = (
        select(Agent)
        .where(
            Agent.is_active.is_(True),
            or_(
                Agent.display_name.ilike(pattern),
                Agent.name.ilike(pattern),
                Agent.description.ilike(pattern),
            ),
        )
        .order_by(Agent.display_name)
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [
        {
            "id": str(a.id),
            "title": a.display_name,
            "subtitle": _highlight_match(a.description or "", query),
            "slug": a.name,
            "url": "/dashboard",
        }
        for a in rows
    ]


async def _search_activities(
    db: AsyncSession, query: str, limit: int
) -> list[dict[str, Any]]:
    pattern = f"%{query}%"
    stmt = (
        select(Activity)
        .where(
            or_(
                Activity.display_name.ilike(pattern),
                Activity.name.ilike(pattern),
            )
        )
        .order_by(Activity.display_name)
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [
        {
            "id": str(a.id),
            "title": a.display_name,
            # Activity não tem `objective`/`description` no model — usa skill_code
            # como subtitle pra mostrar contexto técnico mínimo
            "subtitle": f"skill_code: {a.skill_code}" if a.skill_code else "",
            "slug": a.name,
            "url": "/dashboard",
        }
        for a in rows
    ]


def _search_skills_filesystem(query: str, limit: int) -> list[dict[str, Any]]:
    """Varre opencode/.opencode/skills/<slug>/SKILL.md procurando matches
    no slug do diretório ou na linha `description:` do frontmatter.
    """
    settings = get_settings()
    skills_dir = Path(settings.opencode_config_path) / ".opencode" / "skills"
    if not skills_dir.is_dir():
        return []

    q = query.lower()
    results: list[dict[str, Any]] = []
    for entry in sorted(skills_dir.iterdir()):
        if not entry.is_dir():
            continue
        slug = entry.name
        skill_md = entry / "SKILL.md"
        if not skill_md.is_file():
            continue

        slug_match = q in slug.lower()
        # Lê só linhas iniciais do frontmatter pra extrair description
        description = ""
        try:
            with skill_md.open("r", encoding="utf-8") as f:
                lines: list[str] = []
                for _ in range(15):  # frontmatter geralmente até linha 10
                    line = f.readline()
                    if not line:
                        break
                    lines.append(line)
                in_fm = False
                for line in lines:
                    stripped = line.rstrip("\n")
                    if stripped == "---":
                        in_fm = not in_fm
                        continue
                    if in_fm and stripped.lower().startswith("description:"):
                        description = stripped[len("description:"):].strip().strip('"').strip("'")
                        break
        except OSError:
            description = ""

        desc_match = q in description.lower() if description else False
        if slug_match or desc_match:
            results.append(
                {
                    "id": slug,
                    "title": slug,
                    "subtitle": _highlight_match(description, query),
                    "slug": slug,
                    "url": "/skills",
                }
            )
            if len(results) >= limit:
                break
    return results


@router.get("")
async def search_global(
    q: str = Query(..., min_length=1, max_length=80, description="Termo de busca"),
    limit_per_group: int = Query(default=8, ge=1, le=25),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Busca global agrupada — Postgres ILIKE em deps/agents/activities +
    filesystem scan em skills. Retorna { groups: [...], total: N }."""
    query = q.strip()
    if not query:
        return {"groups": [], "total": 0}

    try:
        depts, agents, activities = (
            await _search_departments(db, query, limit_per_group),
            await _search_agents(db, query, limit_per_group),
            await _search_activities(db, query, limit_per_group),
        )
    except Exception as e:
        log.exception("search.db_error", error=str(e))
        depts, agents, activities = [], [], []

    skills = _search_skills_filesystem(query, limit_per_group)

    groups = []
    if depts:
        groups.append({"kind": "department", "label": "Departamentos", "results": depts})
    if agents:
        groups.append({"kind": "agent", "label": "Digital Employees", "results": agents})
    if activities:
        groups.append({"kind": "activity", "label": "Atividades", "results": activities})
    if skills:
        groups.append({"kind": "skill", "label": "Skills", "results": skills})

    total = sum(len(g["results"]) for g in groups)
    return {"groups": groups, "total": total, "query": query}
