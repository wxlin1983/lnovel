from sqlalchemy import create_engine, text
from sqlalchemy.pool import StaticPool

from app.db.migrations import apply_column_migrations, apply_schema

_ENGINE_KWARGS = dict(
    future=True,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


def _fresh_engine():
    engine = create_engine("sqlite:///:memory:", **_ENGINE_KWARGS)
    apply_schema(engine)
    return engine


def _legacy_engine():
    """Simulate a database created before target_word_count was added."""
    engine = create_engine("sqlite:///:memory:", **_ENGINE_KWARGS)
    with engine.begin() as conn:
        conn.execute(text(
            "CREATE TABLE settings ("
            "id INTEGER PRIMARY KEY CHECK (id = 1),"
            "provider TEXT NOT NULL DEFAULT 'openrouter',"
            "openrouter_api_key TEXT,"
            "preferred_model TEXT NOT NULL DEFAULT 'qwen/qwen-2.5-72b-instruct:free',"
            "ollama_base_url TEXT NOT NULL DEFAULT 'http://host.docker.internal:11434'"
            ")"
        ))
        conn.execute(text("INSERT OR IGNORE INTO settings (id) VALUES (1)"))
        conn.execute(text(
            "CREATE TABLE novels ("
            "id TEXT PRIMARY KEY, title TEXT NOT NULL, premise TEXT NOT NULL DEFAULT '',"
            "inspiration TEXT NOT NULL DEFAULT '', book_outline_json TEXT NOT NULL DEFAULT '[]',"
            "premise_chat_json TEXT NOT NULL DEFAULT '[]', outline_chat_json TEXT NOT NULL DEFAULT '[]',"
            "rolling_summary TEXT NOT NULL DEFAULT '', created_at TEXT, updated_at TEXT"
            ")"
        ))
        conn.execute(text(
            "CREATE TABLE chapters ("
            "id TEXT PRIMARY KEY, novel_id TEXT NOT NULL, chapter_number INTEGER NOT NULL,"
            "title TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'planned',"
            "plan_json TEXT, plan_approved_at TEXT, prose TEXT NOT NULL DEFAULT '',"
            "user_direction TEXT NOT NULL DEFAULT '',"
            "relevant_entity_ids_json TEXT NOT NULL DEFAULT '[]',"
            "created_at TEXT, updated_at TEXT,"
            "UNIQUE(novel_id, chapter_number)"
            ")"
        ))
    return engine


def test_apply_schema_creates_tables():
    engine = _fresh_engine()
    with engine.connect() as conn:
        tables = {r[0] for r in conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))}
    assert {"chapters", "novels", "settings", "entities"}.issubset(tables)
    engine.dispose()


def test_apply_schema_chapters_has_target_word_count():
    engine = _fresh_engine()
    with engine.connect() as conn:
        cols = {r[1] for r in conn.execute(text("PRAGMA table_info(chapters)"))}
    assert "target_word_count" in cols
    engine.dispose()


def test_apply_column_migrations_adds_target_word_count_to_legacy_db():
    engine = _legacy_engine()
    with engine.connect() as conn:
        before = {r[1] for r in conn.execute(text("PRAGMA table_info(chapters)"))}
    assert "target_word_count" not in before

    apply_column_migrations(engine)

    with engine.connect() as conn:
        after = {r[1] for r in conn.execute(text("PRAGMA table_info(chapters)"))}
    assert "target_word_count" in after
    engine.dispose()


def test_apply_column_migrations_idempotent():
    engine = _fresh_engine()
    apply_column_migrations(engine)
    apply_column_migrations(engine)  # must not raise
    engine.dispose()
