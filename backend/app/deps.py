from collections.abc import Generator

from sqlalchemy import Connection

from app.db.engine import get_engine


def get_db() -> Generator[Connection, None, None]:
    engine = get_engine()
    with engine.connect() as conn:
        yield conn
