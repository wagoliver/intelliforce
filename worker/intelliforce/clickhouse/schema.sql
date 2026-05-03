-- =============================================================================
-- IntelliForce — Schema ClickHouse (audit + analytics)
-- =============================================================================
-- Idempotente: roda em todo startup do worker. Cria DB e tabelas se não existem.
-- Tabelas usam MergeTree pra performance analítica + particionamento por dia.
-- =============================================================================

CREATE DATABASE IF NOT EXISTS intelliforce_audit;

-- -----------------------------------------------------------------------------
-- audit_events
-- Cópia completa de cada evento do Postgres `events`, populada pelo audit projector.
-- Aqui ficam os payloads completos pra queries analíticas.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intelliforce_audit.audit_events
(
    event_id          String,                      -- ULID do evento original
    event_type        LowCardinality(String),      -- ex: "task.created"
    aggregate_id      String,
    aggregate_type    LowCardinality(String),
    payload           String,                      -- JSON serializado
    metadata          String,                      -- JSON serializado
    actor             String,
    correlation_id    String,
    causation_id      Nullable(String),
    occurred_at       DateTime64(3, 'UTC'),
    ingested_at       DateTime64(3, 'UTC') DEFAULT now64()
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(occurred_at)
ORDER BY (event_type, aggregate_id, occurred_at, event_id)
SETTINGS index_granularity = 8192;

-- -----------------------------------------------------------------------------
-- llm_calls
-- Cada chamada LLM granular: tokens, custo, latência, modelo, prompt.
-- Permite dashboards de custo/uso por agente, modelo, período.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intelliforce_audit.llm_calls
(
    call_id           String,
    task_id           String,
    agent_name        LowCardinality(String),
    model             LowCardinality(String),
    provider          LowCardinality(String),      -- "lmstudio", "openai", etc.
    input_tokens      UInt32,
    output_tokens     UInt32,
    reasoning_tokens  UInt32 DEFAULT 0,
    cache_read_tokens UInt32 DEFAULT 0,
    cache_write_tokens UInt32 DEFAULT 0,
    cost_usd          Decimal(12, 6) DEFAULT 0,
    latency_ms        UInt32,
    success           UInt8,                       -- 1 = sucesso, 0 = erro
    error_message     String DEFAULT '',
    started_at        DateTime64(3, 'UTC'),
    finished_at       DateTime64(3, 'UTC'),
    correlation_id    String
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(started_at)
ORDER BY (agent_name, model, started_at, call_id)
SETTINGS index_granularity = 8192;

-- -----------------------------------------------------------------------------
-- cli_invocations
-- Cada execução do OpenCode CLI: stdout/stderr completos, exit code, duração.
-- Crítico pra debug e auditoria forense.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intelliforce_audit.cli_invocations
(
    invocation_id     String,
    task_id           String,
    agent_name        LowCardinality(String),
    command           String,                      -- comando completo executado
    stdout            String,                      -- output completo (pode ser grande)
    stderr            String,                      -- logs do OpenCode
    exit_code         Int32,
    duration_ms       UInt32,
    started_at        DateTime64(3, 'UTC'),
    finished_at       DateTime64(3, 'UTC'),
    correlation_id    String
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(started_at)
ORDER BY (agent_name, started_at, invocation_id)
TTL toDateTime(started_at) + INTERVAL 90 DAY     -- mantém 90 dias por padrão
SETTINGS index_granularity = 8192;

-- -----------------------------------------------------------------------------
-- skill_invocations
-- Cada uso de skill por agente — útil pra entender quais skills são mais usados.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intelliforce_audit.skill_invocations
(
    invocation_id     String,
    task_id           String,
    agent_name        LowCardinality(String),
    skill_name        LowCardinality(String),
    arguments         String,                      -- JSON dos argumentos
    result            String,                      -- JSON do resultado
    success           UInt8,
    duration_ms       UInt32,
    started_at        DateTime64(3, 'UTC'),
    correlation_id    String
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(started_at)
ORDER BY (agent_name, skill_name, started_at)
SETTINGS index_granularity = 8192;
