"""Schemas dos endpoints de diagnóstico (tela de Configurações & Saúde).

Diferente de health.py (liveness/readiness pra orquestrador), aqui o foco é
diagnóstico humano: descrição de cada peça, métrica focal, causas prováveis
quando falha.
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


ComponentStatus = Literal["ok", "warn", "err", "unknown"]
ComponentId = Literal[
    "llm", "opencode", "env", "worker", "redis", "postgres", "clickhouse"
]


class Metric(BaseModel):
    """Métrica focal do card (número grande + label mono uppercase)."""
    value: str
    label: str
    unit: str | None = None
    suffix: str | None = None  # ex.: "/13" pra contagens


class DiagnosticComponent(BaseModel):
    """Estado de um componente da plataforma."""
    id: ComponentId
    name: str
    description: str
    status: ComponentStatus
    metric: Metric | None = None
    meta: list[str] = Field(default_factory=list)
    message: str | None = None
    causes: list[str] = Field(default_factory=list)
    last_check: datetime
    latency_ms: float | None = None
    has_guide: bool = False  # se True, frontend mostra botão "Como configurar"


class ConfigGuideStep(BaseModel):
    """Passo numerado dentro de um guia de configuração."""
    title: str
    body: str
    snippet: str | None = None  # bloco de código copiável (env vars, comandos)


class ConfigGuide(BaseModel):
    """Guia humano de como configurar/recuperar um componente."""
    component_id: ComponentId
    title: str
    intro: str
    steps: list[ConfigGuideStep]
    footer_note: str | None = None


class DiagnosticsSummary(BaseModel):
    healthy: int
    warning: int
    error: int
    unknown: int
    total: int


class DiagnosticsStatus(BaseModel):
    """Snapshot completo — saída de GET /diagnostics/status."""
    summary: DiagnosticsSummary
    last_check: datetime
    components: list[DiagnosticComponent]
