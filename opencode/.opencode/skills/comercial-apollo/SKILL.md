---
name: comercial-apollo
description: Vendedor virtual que pesquisa empresas no Apollo.io e sugere abordagens comerciais para o xOne. Foca em empresas brasileiras SMALL (até 200 funcionários).
allowed-tools:
  - Bash(python /opencode-runtime/.opencode/skills/comercial-apollo/scripts/apollo_search.py *)
  - Read
---

# Comercial Apollo — Vendedor Virtual

Skill que conecta à API do Apollo.io, pesquisa empresas brasileiras do perfil SMALL
(até 200 funcionários), retorna dados estruturados e sugere estratégias de abordagem
para vender o xOne.

## Pré-requisitos (Vault)

Esta skill depende de **1 secret single-campo** cadastrado no Cofre (`/vault`):

| Slug | Campo |
|------|-------|
| `apollo` | `api_keys` |

Se o secret ou campo faltar, o script falha com erro categórico.

## Perfis de empresa

| Perfil | Faixa de funcionários |
|--------|----------------------|
| SMALL  | 1 a 200              |
| MID    | 201 a 1000           |
| LARGE  | 1001+                |

O perfil default é **SMALL** — o ICP (Ideal Customer Profile) do xOne.

## Uso

```bash
# Pesquisa default: 3 empresas brasileiras SMALL
python /opencode-runtime/.opencode/skills/comercial-apollo/scripts/apollo_search.py

# Personalizar quantidade
python /opencode-runtime/.opencode/skills/comercial-apollo/scripts/apollo_search.py --limit 10

# Filtrar por setor/indústria
python /opencode-runtime/.opencode/skills/comercial-apollo/scripts/apollo_search.py --industry "Technology"

# Filtrar por estado brasileiro
python /opencode-runtime/.opencode/skills/comercial-apollo/scripts/apollo_search.py --state "Sao Paulo"

# Alterar perfil de empresa (SMALL, MID, LARGE)
python /opencode-runtime/.opencode/skills/comercial-apollo/scripts/apollo_search.py --profile MID
```

## Parâmetros

| Flag | Default | Descrição |
|------|---------|-----------|
| `--limit` | `3` | Quantidade de empresas a retornar |
| `--industry` | (vazio) | Filtro por setor (ex: "Technology", "Healthcare") |
| `--state` | (vazio) | Filtro por estado brasileiro (ex: "Sao Paulo") |
| `--profile` | `SMALL` | Perfil da empresa: SMALL, MID, LARGE |
| `--with-approach` | (desligado) | Incluir sugestão de abordagem comercial no output |

## Output

Array JSON com objetos contendo:
- `id` — Apollo account ID
- `name` — nome da empresa
- `website` — site
- `city`, `state`, `country` — localizacao
- `annual_revenue` — receita anual (formatada ou numerica)
- `primary_domain` — dominio principal
- `founded_year` — ano de fundacao
- `num_contacts` — contatos disponiveis no Apollo
- `linkedin_url`, `facebook_url`, `twitter_url` — redes sociais
- `languages` — idiomas da empresa
- `sic_codes` — codigos SIC
- `approach` — sugestao de abordagem (so com `--with-approach`)

## Notas

- API key e buscada do Vault em memoria. Nada persistido em disco.
- A API do Apollo usa REST no endpoint `https://api.apollo.io/v1/mixed_companies/search`.
- Header de autenticacao: `X-Api-Key`.
- O filtro `organization_num_employees_ranges[]` limita resultados pelo porte.
- Rate limit do Apollo e respeitado.
