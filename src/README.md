# Código-fonte (`src/`)

> Esta pasta está intencionalmente vazia.

O projeto IntelliForce está na **Fase 0 — Concepção** (veja [roadmap](../docs/roadmap.md)). A stack tecnológica ainda não foi escolhida e nenhum código de produção foi escrito.

A estrutura de subpastas (`agents/`, `core/`, `integrations/`, `api/`) reflete a arquitetura conceitual descrita em [`docs/architecture.md`](../docs/architecture.md), e servirá como esqueleto quando entrarmos na Fase 2 (Walking Skeleton).

## Quando preencher cada subpasta

| Pasta | Conteúdo previsto | Fase |
|-------|------------------|------|
| `core/` | Núcleo de orquestração: scheduler, executor, supervisor | Fase 2 |
| `agents/` | Definições declarativas e runtime de funcionários virtuais | Fase 2-3 |
| `integrations/` | Conectores com sistemas externos (LLMs, CRM, ERP, etc.) | Fase 2-3 |
| `api/` | API pública/privada e SDKs | Fase 3 |

## Antes de começar a codar

Antes de qualquer linha de código de produção:

1. As ADRs da Fase 1 precisam estar aprovadas
2. A stack precisa estar escolhida e documentada
3. Spike técnico das decisões críticas precisa ter sido feito
