from pathlib import Path

from sqlalchemy import Connection, Engine, text

SCHEMA_SQL_PATH = Path(__file__).resolve().parent / "schema.sql"

# Columns added to existing tables after their initial release. CREATE TABLE IF NOT EXISTS
# in schema.sql only covers fresh databases, so existing ones need an explicit ALTER TABLE.
NEW_COLUMNS: dict[str, dict[str, str]] = {
    "settings": {
        "provider": "TEXT NOT NULL DEFAULT 'openrouter'",
        "ollama_base_url": "TEXT NOT NULL DEFAULT 'http://host.docker.internal:11434'",
    },
    "novels": {
        "inspiration": "TEXT NOT NULL DEFAULT ''",
        "book_outline_json": "TEXT NOT NULL DEFAULT '[]'",
        "premise_chat_json": "TEXT NOT NULL DEFAULT '[]'",
        "outline_chat_json": "TEXT NOT NULL DEFAULT '[]'",
    },
}


def apply_schema(engine: Engine) -> None:
    schema_sql = SCHEMA_SQL_PATH.read_text()
    with engine.begin() as conn:
        for statement in schema_sql.split(";"):
            statement = statement.strip()
            if statement:
                conn.execute(text(statement))


def _add_missing_columns(conn: Connection, table: str, columns: dict[str, str]) -> None:
    existing = {row[1] for row in conn.execute(text(f"PRAGMA table_info({table})"))}
    for column, ddl in columns.items():
        if column not in existing:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))


def apply_column_migrations(engine: Engine) -> None:
    with engine.begin() as conn:
        for table, columns in NEW_COLUMNS.items():
            _add_missing_columns(conn, table, columns)
