from pathlib import Path

from sqlalchemy import Engine, text

SCHEMA_SQL_PATH = Path(__file__).resolve().parent / "schema.sql"

# Columns added to `settings` after its initial release. CREATE TABLE IF NOT EXISTS in
# schema.sql only covers fresh databases, so existing ones need an explicit ALTER TABLE.
SETTINGS_NEW_COLUMNS = {
    "provider": "TEXT NOT NULL DEFAULT 'openrouter'",
    "ollama_base_url": "TEXT NOT NULL DEFAULT 'http://host.docker.internal:11434'",
}


def apply_schema(engine: Engine) -> None:
    schema_sql = SCHEMA_SQL_PATH.read_text()
    with engine.begin() as conn:
        for statement in schema_sql.split(";"):
            statement = statement.strip()
            if statement:
                conn.execute(text(statement))


def apply_settings_migrations(engine: Engine) -> None:
    with engine.begin() as conn:
        existing = {row[1] for row in conn.execute(text("PRAGMA table_info(settings)"))}
        for column, ddl in SETTINGS_NEW_COLUMNS.items():
            if column not in existing:
                conn.execute(text(f"ALTER TABLE settings ADD COLUMN {column} {ddl}"))
