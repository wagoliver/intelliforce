"""Schemas pra leitura do filesystem opencode/.opencode/ (skills, agents, commands)."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class OpenCodeFile(BaseModel):
    kind: str                       # "skill" | "agent" | "command"
    slug: str                       # nome da pasta (skill) ou nome do .md sem extensão
    name: str | None = None         # do frontmatter
    description: str | None = None  # do frontmatter


class OpenCodeTree(BaseModel):
    skills: list[OpenCodeFile]
    agents: list[OpenCodeFile]
    commands: list[OpenCodeFile]


class OpenCodeContent(BaseModel):
    kind: str
    slug: str
    raw: str
    frontmatter: dict[str, Any]
    body: str
