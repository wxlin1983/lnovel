CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    provider TEXT NOT NULL DEFAULT 'openrouter',
    openrouter_api_key TEXT,
    preferred_model TEXT NOT NULL DEFAULT 'qwen/qwen-2.5-72b-instruct:free',
    ollama_base_url TEXT NOT NULL DEFAULT 'http://host.docker.internal:11434'
);
INSERT OR IGNORE INTO settings (id) VALUES (1);

CREATE TABLE IF NOT EXISTS novels (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    premise TEXT NOT NULL DEFAULT '',
    inspiration TEXT NOT NULL DEFAULT '',
    book_outline_json TEXT NOT NULL DEFAULT '[]',
    premise_chat_json TEXT NOT NULL DEFAULT '[]',
    outline_chat_json TEXT NOT NULL DEFAULT '[]',
    rolling_summary TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS entities (
    id TEXT PRIMARY KEY,
    novel_id TEXT NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('character', 'location', 'storyline')),
    name TEXT NOT NULL,
    fields_json TEXT NOT NULL DEFAULT '{}',
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_entities_novel ON entities(novel_id);

CREATE TABLE IF NOT EXISTS entity_chat_messages (
    id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    proposed_patch_json TEXT,
    applied INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chat_entity ON entity_chat_messages(entity_id);

CREATE TABLE IF NOT EXISTS chapters (
    id TEXT PRIMARY KEY,
    novel_id TEXT NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
    chapter_number INTEGER NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK (status IN ('planned', 'drafted', 'final')) DEFAULT 'planned',
    plan_json TEXT,
    plan_approved_at TEXT,
    prose TEXT NOT NULL DEFAULT '',
    user_direction TEXT NOT NULL DEFAULT '',
    relevant_entity_ids_json TEXT NOT NULL DEFAULT '[]',
    target_word_count INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(novel_id, chapter_number)
);
CREATE INDEX IF NOT EXISTS idx_chapters_novel ON chapters(novel_id);

CREATE TABLE IF NOT EXISTS chapter_plan_revisions (
    id TEXT PRIMARY KEY,
    chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    plan_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chapter_prose_revisions (
    id TEXT PRIMARY KEY,
    chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    prose TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS schema_migrations (
    id INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
