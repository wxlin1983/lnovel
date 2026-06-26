from functools import lru_cache

from sqlalchemy import Engine, create_engine, event

from app.config import settings
from app.db.migrations import apply_column_migrations, apply_schema


@lru_cache
def get_engine() -> Engine:
    engine = create_engine(f"sqlite:///{settings.db_path}", future=True)

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, _):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    apply_schema(engine)
    apply_column_migrations(engine)
    return engine
