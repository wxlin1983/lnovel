import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text
from sqlalchemy.pool import StaticPool

from app.db.migrations import apply_column_migrations, apply_schema
from app.deps import get_db
from app.main import app


def _make_engine():
    # StaticPool + check_same_thread=False keeps a single in-memory DB connection
    # that is safe to share across threads (which TestClient uses).
    engine = create_engine(
        "sqlite:///:memory:",
        future=True,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _pragmas(dbapi_conn, _):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()

    apply_schema(engine)
    apply_column_migrations(engine)
    return engine


@pytest.fixture()
def db_engine():
    engine = _make_engine()
    yield engine
    engine.dispose()


@pytest.fixture()
def client(db_engine):
    def override_get_db():
        with db_engine.connect() as conn:
            yield conn

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def novel_id(client):
    r = client.post("/api/novels", json={"title": "Test Novel"})
    assert r.status_code == 201
    return r.json()["id"]
