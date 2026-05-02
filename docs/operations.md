# Operação Local — IntelliForce

> Como subir, parar, monitorar e debugar o IntelliForce no seu Mac mini.

## Pré-requisitos

- **Docker Desktop** (com Docker Compose v2)
- **LM Studio** rodando no host (Mac mini), com modelo carregado e "Serve on Local Network" ativo
- **Git** + acesso ao repositório
- macOS ou Linux (Windows via WSL2 funciona, mas não testado)

## Setup inicial (uma vez)

```bash
# 1. Clonar o repo
git clone https://github.com/wagoliver/intelliforce.git
cd intelliforce

# 2. Bootstrap (cria .env e gera secrets)
./scripts/bootstrap.sh

# 3. Subir stack
docker compose up -d --build
```

O `bootstrap.sh` faz:
- Copia `.env.example` → `.env`
- Gera `JWT_SECRET` aleatório (64 chars hex)
- Gera senha admin inicial (mostra na tela — **anote!**)
- Valida que LM Studio responde

## Comandos diários

### Subir tudo

```bash
docker compose up -d --build
```

`-d` = detached (em background). Tira pra rodar em foreground se quiser ver tudo no terminal.
`--build` = reconstrói imagens se Dockerfile mudou. Pode omitir nas próximas vezes.

### Parar tudo

```bash
docker compose down
```

Para os containers mas **mantém os volumes** (dados persistem).

### Parar e apagar dados

```bash
docker compose down -v
```

`-v` apaga volumes. **Cuidado:** perde tudo do Postgres, ClickHouse, Redis.

### Ver logs

```bash
# Todos os serviços
docker compose logs -f

# Só o worker
docker compose logs -f worker

# Últimas 100 linhas e seguir
docker compose logs -f --tail 100 worker
```

### Restart de um serviço

```bash
docker compose restart worker
```

### Status

```bash
docker compose ps
```

Mostra estado de cada container e healthcheck.

## Debug

### Entrar no container worker

```bash
docker compose exec worker bash
```

Dentro do container você pode:

```bash
# Validar OpenCode instalado
opencode --version

# Listar agentes configurados
ls /workspace/opencode/agent/

# Rodar OpenCode manualmente
opencode run --format json --dangerously-skip-permissions \
  "diga olá em uma palavra"

# Conectar no Postgres
PGPASSWORD=$POSTGRES_PASSWORD psql -h postgres -U $POSTGRES_USER -d $POSTGRES_DB

# Conectar no ClickHouse
clickhouse-client -h clickhouse -u $CLICKHOUSE_USER --password=$CLICKHOUSE_PASSWORD

# Conectar no Redis
redis-cli -h redis
```

### Conectar nos bancos do host

Pelos clientes externos (DBeaver, TablePlus, RedisInsight):

| Serviço | Host | Porta | User | Pass | DB |
|---------|------|-------|------|------|-----|
| Postgres | localhost | 5432 | (do .env) | (do .env) | intelliforce |
| ClickHouse | localhost | 8123 (HTTP) ou 9000 | (do .env) | (do .env) | intelliforce_audit |
| Redis | localhost | 6379 | — | — | 0 |

## Troubleshooting

### "host.docker.internal not found"

Significa que o container não está conseguindo achar o host. Verifique:
- Está rodando em macOS ou Windows? (Linux precisa do `extra_hosts` no compose — já configurado)
- LM Studio está rodando no host?
- LM Studio está com "Serve on Local Network" ativo?

Teste do container:
```bash
docker compose exec worker curl -v http://host.docker.internal:1234/v1/models
```

### "Worker fica reiniciando"

Provavelmente erro nas migrations ou conexão. Veja os logs:
```bash
docker compose logs --tail 50 worker
```

### Reset completo

Se algo travou de jeito que você quer começar do zero:

```bash
docker compose down -v
docker compose up -d --build
```

### Limpar imagens antigas

```bash
docker image prune -a
```

(Cuidado: apaga TODAS as imagens não usadas, não só do IntelliForce.)

## Arquitetura — onde cada serviço escuta

| Serviço | Porta interna | Porta externa | Pra que |
|---------|---------------|---------------|---------|
| postgres | 5432 | 5432 | Estado transacional |
| clickhouse | 8123 (HTTP), 9000 | 8123, 9000 | Eventos verbosos + analytics |
| redis | 6379 | 6379 | Fila + event bus |
| worker | — | — | Consome eventos, invoca OpenCode |
| LM Studio | (host) | (host) 1234 | LLM provider |

## Próximos passos

- API + endpoints virão na **Sprint 4** (cards IN-15, IN-16)
- Frontend vem **pós-MVP** (cards IN-26 e família)

Veja o [board completo no Jira](https://enlevoengenharia-team.atlassian.net/jira/software/projects/IN/boards/34) e [`docs/architecture-evolution.md`](./architecture-evolution.md) pra contexto das decisões.
