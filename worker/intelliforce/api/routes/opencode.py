"""Endpoints de leitura do filesystem opencode/.opencode/.

Separa-se intencionalmente do endpoint /agents (que é CRUD do Postgres) — aqui
expõe-se apenas o que está no disco: skills, agents e commands declarados em
markdown que o OpenCode CLI consome.

MVP: read-only. Edição passa pelo agente builder via /chat/stream.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import structlog
import yaml
from fastapi import APIRouter, Depends, HTTPException, status

from intelliforce.api.deps import get_current_user
from intelliforce.api.schemas.opencode import (
    OpenCodeContent,
    OpenCodeFile,
    OpenCodeTree,
)
from intelliforce.db.models.user import User
from intelliforce.settings import get_settings

router = APIRouter(prefix="/opencode", tags=["opencode"])
log = structlog.get_logger()


def _opencode_root() -> Path:
    """Retorna o path absoluto pra <config_path>/.opencode/.

    Em dev local é tipicamente <repo>/opencode/.opencode/.
    Em Docker é /opencode-runtime/.opencode/ (mount).
    """
    settings = get_settings()
    return Path(settings.opencode_config_path) / ".opencode"


def _parse_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    """Extrai frontmatter YAML delimitado por --- no topo. Retorna (frontmatter, body).

    Se não houver frontmatter ou parse falhar, retorna ({}, text inteiro).
    """
    if not text.startswith("---\n") and not text.startswith("---\r\n"):
        return {}, text
    # Encontra o segundo "---" delimiter
    lines = text.splitlines(keepends=True)
    if not lines or not lines[0].strip() == "---":
        return {}, text
    end_idx = -1
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            end_idx = i
            break
    if end_idx == -1:
        return {}, text
    fm_text = "".join(lines[1:end_idx])
    body = "".join(lines[end_idx + 1:])
    try:
        fm = yaml.safe_load(fm_text) or {}
        if not isinstance(fm, dict):
            fm = {}
    except yaml.YAMLError as e:
        log.warning("opencode.frontmatter_parse_error", error=str(e))
        fm = {}
    return fm, body


def _read_skills(root: Path) -> list[OpenCodeFile]:
    skills_dir = root / "skills"
    if not skills_dir.is_dir():
        return []
    out: list[OpenCodeFile] = []
    for entry in sorted(skills_dir.iterdir()):
        if not entry.is_dir():
            continue
        skill_md = entry / "SKILL.md"
        if not skill_md.is_file():
            continue
        try:
            content = skill_md.read_text(encoding="utf-8")
            fm, _ = _parse_frontmatter(content)
        except OSError as e:
            log.warning("opencode.skill_read_error", path=str(skill_md), error=str(e))
            fm = {}
        out.append(
            OpenCodeFile(
                kind="skill",
                slug=entry.name,
                name=fm.get("name") if isinstance(fm.get("name"), str) else None,
                description=fm.get("description") if isinstance(fm.get("description"), str) else None,
            )
        )
    return out


def _read_md_dir(root: Path, kind: str, subdir: str) -> list[OpenCodeFile]:
    """Lê arquivos .md diretos de uma pasta (agents, commands)."""
    target = root / subdir
    if not target.is_dir():
        return []
    out: list[OpenCodeFile] = []
    for entry in sorted(target.iterdir()):
        if not entry.is_file() or entry.suffix.lower() != ".md":
            continue
        try:
            content = entry.read_text(encoding="utf-8")
            fm, _ = _parse_frontmatter(content)
        except OSError as e:
            log.warning("opencode.md_read_error", path=str(entry), error=str(e))
            fm = {}
        out.append(
            OpenCodeFile(
                kind=kind,
                slug=entry.stem,
                name=fm.get("name") if isinstance(fm.get("name"), str) else None,
                description=fm.get("description") if isinstance(fm.get("description"), str) else None,
            )
        )
    return out


def _safe_slug(slug: str) -> str:
    """Validação anti-traversal: slug só pode ter [a-z0-9-_]."""
    if not slug or not all(c.isalnum() or c in "-_" for c in slug):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Slug inválido")
    return slug


def _resolve_safely(base: Path, target: Path) -> Path:
    """Garante que target está dentro de base (anti path-traversal)."""
    base_r = base.resolve()
    target_r = target.resolve()
    try:
        target_r.relative_to(base_r)
    except ValueError as e:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Path fora do escopo") from e
    return target_r


@router.get("/tree", response_model=OpenCodeTree)
async def get_tree(
    user: User = Depends(get_current_user),
) -> OpenCodeTree:
    """Lista todos os skills, agents e commands declarados no filesystem."""
    root = _opencode_root()
    return OpenCodeTree(
        skills=_read_skills(root),
        agents=_read_md_dir(root, "agent", "agents"),
        commands=_read_md_dir(root, "command", "commands"),
    )


@router.get("/skills/{slug}", response_model=OpenCodeContent)
async def get_skill(
    slug: str,
    user: User = Depends(get_current_user),
) -> OpenCodeContent:
    slug = _safe_slug(slug)
    root = _opencode_root()
    target = root / "skills" / slug / "SKILL.md"
    target = _resolve_safely(root, target)
    if not target.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Skill não encontrada")
    raw = target.read_text(encoding="utf-8")
    fm, body = _parse_frontmatter(raw)
    return OpenCodeContent(kind="skill", slug=slug, raw=raw, frontmatter=fm, body=body)


@router.get("/agents/{slug}", response_model=OpenCodeContent)
async def get_agent(
    slug: str,
    user: User = Depends(get_current_user),
) -> OpenCodeContent:
    slug = _safe_slug(slug)
    root = _opencode_root()
    target = root / "agents" / f"{slug}.md"
    target = _resolve_safely(root, target)
    if not target.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Agente não encontrado")
    raw = target.read_text(encoding="utf-8")
    fm, body = _parse_frontmatter(raw)
    return OpenCodeContent(kind="agent", slug=slug, raw=raw, frontmatter=fm, body=body)


@router.get("/commands/{slug}", response_model=OpenCodeContent)
async def get_command(
    slug: str,
    user: User = Depends(get_current_user),
) -> OpenCodeContent:
    slug = _safe_slug(slug)
    root = _opencode_root()
    target = root / "commands" / f"{slug}.md"
    target = _resolve_safely(root, target)
    if not target.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Comando não encontrado")
    raw = target.read_text(encoding="utf-8")
    fm, body = _parse_frontmatter(raw)
    return OpenCodeContent(kind="command", slug=slug, raw=raw, frontmatter=fm, body=body)
