---
name: intelliforce-agents
description: CRUD de agents (definições de digital employees). Um agent é o "papel" — referencia um arquivo .md em opencode/.opencode/agents/, define modelo de LLM, skills habilitadas e políticas. Pra contratar de fato, depois usa intelliforce-instances pra scale numa activity.
license: MIT
allowed-tools:
  - Bash(python /opencode-runtime/.opencode/skills/intelliforce-agents/scripts/agents.py *)
  - Read
---

# Agents — CRUD de definições de digital employees

Um Agent (no sentido IntelliForce) é a **definição** de um papel: nome,
modelo de LLM que executa, skills disponíveis, arquivo .md no OpenCode que
contém as instruções. NÃO é a "vaga contratada" — pra ter trabalhador
ativo numa activity, precisa também usar `intelliforce-instances` (scale).

## Comandos

```bash
python .../agents.py list
python .../agents.py get <uuid>

# Criar — referencia um .md já existente no opencode/.opencode/agents/
python .../agents.py create \
    --name validador-de-notas \
    --display-name "Validador de Notas" \
    --opencode-agent-file "agents/validador-de-notas.md" \
    --model "lmstudio/qwen3.6-27b-mtp" \
    --skills consulta-itsm,intelliforce-api \
    --description "Valida CNPJs e dados fiscais antes do downstream"

# Atualizar
python .../agents.py update <uuid> --display-name "Validador BR" --is-active true

# Deletar (cuidado — instâncias órfãs ficam sem definição)
python .../agents.py delete <uuid>
```

## Campos obrigatórios

- **name** — slug kebab-case único (regex `^[a-z0-9]+(-[a-z0-9]+)*$`)
- **display_name** — nome amigável até 255 chars
- **opencode_agent_file** — path do .md (relativo a opencode/.opencode/), ex:
  `agents/validador-de-notas.md`. **Esse arquivo precisa existir** —
  geralmente foi criado antes pelo agente `builder` (use o switcher).
- **model** — string identificando o modelo (ex: `lmstudio/qwen3.6-27b-mtp`)

## Campos opcionais

- **description** — descrição até 4000 chars
- **skills** — lista de slugs de skills habilitadas pra esse agent
- **policies** — dict JSON com regras (limites, aprovações)
- **schedule** — cron pra disparar automaticamente sem activity (raro)
- **is_active** — true (default) ou false (desativa sem deletar)
- **manager_user_id** — UUID do user humano gestor

## Fluxo recomendado pra criar digital employee novo

1. **Antes de criar Agent**, verifique se já existe um arquivo .md adequado
   em `opencode/.opencode/agents/`. Se não:
   - Pedir pro user trocar pro **builder** no switcher e criar o .md primeiro
   - Voltar pro operator e referenciar o arquivo recém-criado
2. Confirmar com user qual modelo usar (LM Studio? OpenAI? — afeta custo)
3. POST → operator retorna ID + sugere atribuir a uma activity via
   `intelliforce-instances` scale

## Atenção

- Operator NÃO escreve arquivos no filesystem (`write: false`). Pra criar o
  arquivo `.md` que a Agent referencia, o user precisa usar o **builder**.
- Após criar Agent, ele ainda não está "trabalhando". Precisa de instances
  via scale. Mencione isso ao user.
