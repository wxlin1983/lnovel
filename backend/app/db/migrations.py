from pathlib import Path

from sqlalchemy import Engine, text

SCHEMA_SQL_PATH = Path(__file__).resolve().parent / "schema.sql"


def apply_schema(engine: Engine) -> None:
    schema_sql = SCHEMA_SQL_PATH.read_text()
    with engine.begin() as conn:
        for statement in schema_sql.split(";"):
            statement = statement.strip()
            if statement:
                conn.execute(text(statement))
