# OpenCode — Inteligência dos Agentes

Esta pasta contém **toda a inteligência da plataforma IntelliForce**: agentes (papéis), skills (capacidades) e commands (gatilhos slash) executados pelo OpenCode CLI.

## Estrutura

```
opencode/
├── opencode.json       # Config do OpenCode (providers, modelos, default)
├── agent/              # Funcionários virtuais (.md por agente)
├── skill/              # Capacidades reutilizáveis (pasta por skill)
└── command/            # Gatilhos slash (.md por comando)
```

## Convenções

- **Skill**: pasta com nome em `kebab-case` (`consulta-crm`, `enviar-email`). Dentro, `SKILL.md` obrigatório com frontmatter (name + description).
- **Agent**: arquivo `.md` com nome do agente (`analista-cobranca-pj.md`). Frontmatter com `name`, `description`, `mode`, `tools`, `model`.
- **Command**: arquivo `.md` em `kebab-case` (`triar-clientes-pj.md`). Frontmatter com `agent` opcional.

Detalhes completos em [`docs/agent-spec.md`](../docs/agent-spec.md).

## Como rodar manualmente

Dentro do container worker:

```bash
opencode run --format json --dangerously-skip-permissions \
  --agent analista-cobranca-pj \
  "Analise o cliente XYZ"
```

## Provider configurado

LM Studio rodando no host (Mac mini), acessível via `host.docker.internal:1234/v1`.

Pra rodar fora do Docker (desenvolvimento direto no Mac), troque temporariamente o `baseURL` em `opencode.json` pra `http://127.0.0.1:1234/v1`.
