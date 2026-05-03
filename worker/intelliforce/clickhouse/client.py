"""Cliente ClickHouse + bootstrap de schema."""
import re
from pathlib import Path

import clickhouse_connect
import structlog

from intelliforce.settings import get_settings

log = structlog.get_logger()


def get_client():
    """Cria cliente ClickHouse usando configurações do .env."""
    settings = get_settings()
    return clickhouse_connect.get_client(
        host=settings.clickhouse_host,
        port=settings.clickhouse_http_port,
        username=settings.clickhouse_user,
        password=settings.clickhouse_password,
    )


def _split_sql_statements(sql: str) -> list[str]:
    """Divide SQL em statements, ignorando comentários '--' e linhas vazias.

    Faz parse linha-a-linha pra remover comentários antes de juntar e dividir por ';'.
    """
    cleaned_lines = []
    for line in sql.splitlines():
        # Remove comentário inline mas preserva conteúdo antes dele
        idx = line.find("--")
        if idx >= 0:
            line = line[:idx]
        line = line.rstrip()
        if line.strip():
            cleaned_lines.append(line)

    cleaned_sql = "\n".join(cleaned_lines)
    statements = [s.strip() for s in cleaned_sql.split(";") if s.strip()]
    return statements


def apply_schema() -> None:
    """Aplica o schema ClickHouse (CREATE IF NOT EXISTS — idempotente)."""
    schema_path = Path(__file__).parent / "schema.sql"
    if not schema_path.exists():
        log.warning("clickhouse.schema.missing", path=str(schema_path))
        return

    sql = schema_path.read_text(encoding="utf-8")
    statements = _split_sql_statements(sql)

    log.info("clickhouse.schema.applying", statements_count=len(statements))

    client = get_client()
    failed = []
    try:
        for i, statement in enumerate(statements):
            preview = re.sub(r"\s+", " ", statement)[:80]
            try:
                client.command(statement)
                log.info("clickhouse.statement.ok", index=i, preview=preview)
            except Exception as e:
                log.error("clickhouse.statement.failed", index=i, preview=preview, error=str(e))
                failed.append((i, preview, str(e)))
    finally:
        client.close()

    if failed:
        log.error("clickhouse.schema.partial", failures=len(failed))
        raise RuntimeError(f"{len(failed)} statements falharam ao aplicar schema ClickHouse")

    log.info("clickhouse.schema.applied", source=str(schema_path), statements=len(statements))


if __name__ == "__main__":
    """Permite rodar standalone: python -m intelliforce.clickhouse.client"""
    import logging
    logging.basicConfig(level=logging.INFO)
    apply_schema()
    print("ClickHouse schema aplicado.")
