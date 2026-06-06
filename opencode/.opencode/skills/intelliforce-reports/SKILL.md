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
temporário e suba pro Report Center. O backend renderiza o PDF on-demand a partir
do Markdown, então **a qualidade do Markdown define a qualidade do PDF**.

## Fluxo

```bash
# 1. Antes de escrever: veja o relatório anterior pra calcular tendência (ver §"Tendência")
python .../reports.py list --department <uuid> --limit 5
python .../reports.py get --id <id_do_relatorio_anterior>

# 2. Escreva o relatório em Markdown num arquivo (Write tool) seguindo o PADRÃO abaixo.

# 3. Suba:
python .../reports.py create \
    --title "Relatório Geral de Chamados — 06/06/2026" \
    --content-file /tmp/relatorio.md \
    --summary "32 chamados abertos, 4 P2 críticos do Itaú aguardando cliente" \
    --department <department_uuid> \
    --tags "chamados,diário"
```

---

# PADRÃO DE RELATÓRIO — siga sempre

Um relatório bom responde, em 5 segundos de leitura, **"o que precisa da minha
atenção agora?"**. Não é um dump de dados — é uma leitura executiva.

## 1. Escrita

- **Português com acentuação correta.** Escreva *Relatório, Crítico, Classificação,
  Ação, Análise, Distribuição* — não remova acentos. (O encoding já está correto.)
- **Concordância e nomes certos:** "Resumo Executivo", "Análise de Risco".
- Frases curtas. Números sempre com contexto ("há 23 dias", "12,5% do total").
- Não invente dados. Se um número não existe na fonte, omita a linha — nunca chute.

## 2. Estrutura (nesta ordem)

1. **Título** (`# H1`) com período/data no próprio título.
2. **Linha de metadados** logo abaixo: *Gerado em · Departamento · Atividade ·
   Período coberto · Fonte* (ex.: Zoho Desk).
3. **⚠️ Ações agora** — **vem antes de tudo**. 2 a 5 itens do que exige atenção
   imediata, cada um com **o quê, qual ticket/responsável e por quê**. É a primeira
   coisa que o gestor lê.
4. **Resumo executivo** — 3 a 4 bullets com os destaques (totais, o que mudou).
5. **Indicadores (KPIs)** — tabela enxuta com os números-chave.
6. **Detalhamento** — uma tabela **por dimensão**: por Prioridade, por Tipo, por
   Status, por Organização, por Analista. **Nunca misture dimensões diferentes na
   mesma tabela** (organização ≠ analista).
7. **Aging / Risco de SLA** — quantifique: dias em aberto por item crítico, item
   mais antigo, e quantos estão em risco. Não só "está aberto há um tempo".
8. **Tendência** — comparação com o período anterior (ver §3).
9. **Rodapé** — `*Relatório gerado automaticamente pela atividade ... em <data>.*`

## 3. Tendência (vs. período anterior)

Antes de escrever, rode `list` + `get` no **último relatório do mesmo
departamento/atividade**. Compare os números e mostre a variação com seta e valor:

```
| Métrica | Hoje | Anterior | Variação |
|---|---|---|---|
| Total aberto | 32 | 28 | ▲ +4 |
| P2 críticos | 4 | 6 | ▼ −2 |
```

Use **▲** (subiu) / **▼** (caiu) / **▬** (estável). Se não houver relatório
anterior, escreva "Primeiro relatório — sem base de comparação" e siga.

## 4. Consistência (cheque antes de subir)

- **Os somatórios batem com o total.** Se as partes não somam o total, inclua uma
  linha **"Outros"** ou explique a diferença. Números que não fecham destroem a
  confiança no relatório.
- **Percentuais somam ~100%** dentro de cada dimensão.
- **Uma dimensão por tabela.** Se você listou analistas, não os misture com
  organizações.
- **Tabelas Markdown válidas** (cabeçalho + linha `|---|`), sem células vazias soltas.

## 5. `--summary`

Uma frase (≤ 120 chars) com o destaque mais importante — é o que aparece na lista
do app e na **notificação push**. Foque no que é acionável:
`"32 chamados, 4 P2 críticos do Itaú aguardando cliente há 5+ dias"`.

---

## Campos do `create`

- **--title** (obrigatório): inclua a data/período (até 255 chars).
- **--content-file** (obrigatório): caminho do `.md`.
- **--summary** (recomendado): 1 linha de destaque (lista + push).
- **--department** (recomendado): UUID do departamento dono.
- **--agent** (opcional): UUID do agente que gerou.
- **--tags** (opcional): separadas por vírgula.

## Output

`create` retorna JSON com `id`, `title`, `size_bytes`, `created_at`. Avise o usuário
que o relatório está no app (aba **Relatórios** no mobile), com download em .md/.pdf
e opção de compartilhar.
