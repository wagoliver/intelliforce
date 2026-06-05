---
name: intelliforce-reports
description: Salvar relatórios (Markdown) no Report Center do IntelliForce — a saída nativa de uma atividade. Use quando o usuário pede um relatório/documento (ex: "gere um relatório de chamados"). O documento fica disponível pro gestor ver, baixar (.md/.pdf) e compartilhar pelo app.
license: MIT
allowed-tools:
  - Bash(python /opencode-runtime/.opencode/skills/intelliforce-reports/scripts/reports.py *)
  - Write
  - Read
---

# Reports — entregar relatórios no Report Center

Quando você precisar **entregar** um documento como saída de uma atividade
(relatório, resumo, análise), gere o conteúdo em **Markdown**, salve num arquivo
temporário e suba pro Report Center via a skill. O backend renderiza o PDF
on-demand a partir do Markdown.

## Fluxo

1. Escreva o relatório em Markdown num arquivo (ex: `/tmp/relatorio.md`) com a tool Write.
2. Suba com `create`:

```bash
python .../reports.py create \
    --title "Relatório de Chamados — Junho" \
    --content-file /tmp/relatorio.md \
    --summary "142 chamados, 8 críticos em aberto" \
    --department <department_uuid> \
    --tags "chamados,mensal"

# Listar relatórios recentes
python .../reports.py list --limit 20
```

## Campos

- **--title** (obrigatório): título do relatório (até 255 chars).
- **--content-file** (obrigatório): caminho do arquivo Markdown.
- **--summary** (opcional): 1 linha de resumo (aparece na lista do app).
- **--department** (opcional): UUID do departamento dono.
- **--tags** (opcional): tags separadas por vírgula.

## Output

Retorna JSON com `id`, `title`, `size_bytes`, `created_at`. Mencione ao usuário
que o relatório está disponível no app (aba **Relatórios**), com download em
.md/.pdf e opção de compartilhar.
