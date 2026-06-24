# lnovel — AI-Assisted Novel Writing App

## Context

`/workspace/lnovel` is a fresh repo (MIT licensed, only LICENSE + git init, no code). The goal is an AI-assisted novel-writing web app: the user builds structured worldbuilding (characters/locations/storylines), can converse with an LLM to refine any entity, gets an LLM-generated chapter beat-plan to review/approve, then gets LLM-generated prose for that chapter — aiming to cover a full book-length novel despite using small-context free OpenRouter models. Key confirmed decisions: **single-user app, no login/accounts**, React+Vite frontend, Python/FastAPI backend, one SQLite database (self-hosted style), OpenRouter free models with the user's own API key entered in a Settings page, rolling-summary context-compression strategy, multiple novels supported (just no multi-tenancy), novel content generated mostly in **Traditional Chinese (繁體中文)**, deployed as a single Docker container.

## Architecture

`frontend/` (React+Vite+TS, managed with **pnpm**) and `backend/` (Python/FastAPI, managed with **uv**). No auth layer at all — this is a single-user, single-deployment app; whoever can reach the container is "the user." No shared-package coupling between the two apps since they're different languages — the backend exposes Pydantic request/response models via OpenAPI, and the frontend keeps a hand-written `frontend/src/types/api.ts` in sync (acceptable duplication at this scope).

**Novel content language**: the generated story content — chapter plans, prose, rolling summaries, and the entity-improvement chat's prose-facing output — should be **mostly Traditional Chinese**. Enforced at the prompt level (every prompt builder's system instruction includes "請以繁體中文回覆/寫作"); JSON keys/status enums stay in English since those are code-facing. UI chrome ended up in Traditional Chinese too (buttons, labels, nav across every page), superseding the original English-chrome plan. Not all free OpenRouter models handle Chinese well, so the catalog the Settings page draws from (`backend/app/llm/model_catalog.py` for OpenRouter, `backend/app/llm/ollama_catalog.py` for local Ollama) should preference models with known solid Chinese capability (e.g. Qwen/GLM variants, alongside Llama/Gemma/Mistral), with the Settings page letting the user swap providers/models if one's Chinese output quality is poor.

**Navigation**: every page carries a `← 返回...` link (styled `text-sm text-purple-600 underline`) back to its logical parent — the novels list (`/`) from the novel dashboard and Settings, the novel dashboard from chapter plan, chapter plan from chapter prose. Kept deliberately uniform across pages rather than introducing a shared nav/breadcrumb component, since there are only a handful of pages and the parent-link relationship is always a single fixed route.

**Backend**: **FastAPI** + **SQLAlchemy Core (sync)** — not the full ORM — against a single SQLite file (`data/lnovel.db`, WAL mode). Core query-building gives typed `select`/`insert`/`update` without ORM session-lifecycle overhead, and there's no longer a multi-engine-per-user concern since there's exactly one DB. Hand-rolled `schema.sql` + a tiny migrations runner (no Alembic needed for this table count; adding columns to an already-existing table goes through an idempotent `PRAGMA table_info`-guarded `ALTER TABLE` step in `migrations.py`, since `CREATE TABLE IF NOT EXISTS` alone only covers fresh databases). **Pydantic v2** for all request/response validation. Settings live in a single-row `settings` table (`provider`, OpenRouter key, preferred model, Ollama base URL) edited via a Settings page — no auth in front of it (single-user app), but the key is still never echoed back in any GET response, only a `has_key: bool`. **httpx** (async) to call the configured LLM provider, including streaming; FastAPI's `StreamingResponse`/`sse-starlette` to relay streaming completions to the frontend. Served via `uvicorn`.

**LLM provider abstraction**: the app supports two interchangeable providers — **OpenRouter** (cloud, free-tier models, requires an API key) and a **local Ollama** instance (no key, reachable via a user-configured base URL, defaulting to `http://host.docker.internal:11434` so the container can reach Ollama running on the Docker host). Both speak the same OpenAI-compatible chat-completions JSON/SSE shape, so `app/llm/llm_client.py` implements the HTTP/parsing logic once, parameterized by `endpoint_url`/`api_key` rather than hardcoded to one provider. `app/llm/provider_config.py::load_provider_config()` is the single place that reads the `settings` row and resolves it into a `ProviderConfig` (endpoint URL, key, model, which HTTP status means "try a different model" — 402/payment-required for OpenRouter, 404/not-pulled for Ollama — plus a callable to fetch that provider's fallback model candidates). All call sites (`chapter_plan.py`, `chapter_prose.py`, `entity_chat.py`) go through this one function instead of duplicating provider-switch logic. `app/llm/model_catalog.py` (OpenRouter's free-model list, cached 1h) and `app/llm/ollama_catalog.py` (Ollama's locally-pulled models, via `GET {base_url}/api/tags`, uncached) are the two catalog sources behind `GET /api/models`.

**Frontend**: Vite + React + TS, `react-router-dom`, `@tanstack/react-query` for server state, `react-hook-form`+zod for entity forms, `@microsoft/fetch-event-source` for consuming POST-based SSE streams, Tailwind for styling.

**Deployment**: single Docker image. Multi-stage `Dockerfile`: stage 1 builds the Vite frontend (`pnpm install && pnpm build` → static `dist/`), stage 2 is the Python/uv backend image which copies the built frontend's `dist/` into a static directory FastAPI serves (e.g. `app.mount("/", StaticFiles(directory="static", html=True))` for everything not under `/api`). One process, one port, one `docker-compose.yml` with a single service and a named volume (or bind mount) for `data/` so the SQLite file persists across container restarts/upgrades.

### Data model (single SQLite DB, `data/lnovel.db`)

- `settings` (single row: id=1, provider, openrouter_api_key, preferred_model, ollama_base_url)
- `novels` (id, title, premise, **rolling_summary** — the compressed "story so far")
- `entities` (id, novel_id, type: character|location|storyline, name, **fields_json**, description) — semi-structured per-type fields stored as JSON text rather than per-type tables
- `entity_chat_messages` (id, entity_id, role, content, proposed_patch_json, applied) — backs the "Improve with AI" chat + explicit accept-patch step
- `chapters` (id, novel_id, chapter_number, status: planned|drafted|final, plan_json, plan_approved_at, prose, user_direction, relevant_entity_ids_json)
- `chapter_plan_revisions`, `chapter_prose_revisions` — history for regenerate UX
- `schema_migrations`

### Backend project layout

```
backend/
├── pyproject.toml + uv.lock    # managed via `uv`; deps: fastapi, uvicorn, sqlalchemy, pydantic, pydantic-settings, httpx, sse-starlette
├── app/
│   ├── main.py                 # FastAPI() app, router includes, static file mount for built frontend
│   ├── config.py               # pydantic-settings, validates env vars at boot (DB path, etc.)
│   ├── deps.py                  # get_db FastAPI dependency (single shared Engine)
│   ├── db/
│   │   ├── engine.py            # single SQLAlchemy Engine for data/lnovel.db
│   │   ├── schema.sql
│   │   └── migrations.py
│   ├── routers/
│   │   ├── settings.py, novels.py, entities.py, entity_chat.py, chapters.py, chapter_plan.py, chapter_prose.py
│   ├── llm/
│   │   ├── llm_client.py         # httpx streaming/non-streaming + error mapping, provider-agnostic
│   │   ├── provider_config.py    # resolves `settings` row -> ProviderConfig (openrouter | ollama)
│   │   ├── model_catalog.py      # OpenRouter free-model list (cached)
│   │   ├── ollama_catalog.py     # local Ollama installed-model list (uncached)
│   │   └── prompts/
│   │       ├── entity_improve.py, chapter_plan.py, chapter_prose.py, rolling_summary.py
│   └── schemas/                 # pydantic models, mirrors the data model above
└── scripts/
    └── smoke.py                  # manual end-to-end smoke script (httpx against running server)
```

### API surface (all under `/api`, no auth)

- Settings: `GET/PUT /api/settings` (provider, openrouter key write-only / `has_key` boolean, preferred model, Ollama base URL)
- Models: `GET /api/models` (optional `?provider=` override) — lists OpenRouter's free models or Ollama's locally-pulled models, depending on the active/queried provider
- Novels: standard CRUD
- Entities: standard CRUD, scoped to a novel
- Entity chat: `GET/POST .../entities/:id/chat` (POST streams via SSE, persists messages + any proposed JSON patch), `POST .../chat/:messageId/apply-patch` (explicit user-accept step that merges the patch into `fields_json`)
- Chapters: standard CRUD
- Plan: `POST .../plan` (generate), `PUT .../plan` (manual edit), `POST .../plan/regenerate`, `POST .../plan/approve` (sets `plan_approved_at`, gates prose generation server-side)
- Prose: `POST .../prose` (SSE generate, requires approved plan), `POST .../prose/regenerate`, `PUT .../prose` (manual save), `POST .../finalize` (sets status final, triggers rolling-summary update), `GET .../revisions`

### Context-budgeting strategy (the core technical risk this app manages)

Never send the full manuscript. Each AI action assembles a deliberately scoped prompt, truncated to roughly an 8k-token budget:
- **Entity chat**: entity's own fields/description + brief novel premise + (for storylines) one-line summaries of linked entities + capped recent chat history.
- **Chapter plan generation**: novel premise + `rolling_summary` + previous chapter's plan and a short excerpt of its prose + all active storylines (full detail) + characters (name/role only, unless user explicitly tags entities as relevant to this chapter via `relevant_entity_ids_json`) + user's free-text direction. Output is a pydantic-validated JSON beat plan (JSON structure in English, free-text fields like `summary`/`description` written in Traditional Chinese); one retry on malformed JSON.
- **Chapter prose generation**: novel premise + `rolling_summary` + the approved plan + full detail only for entities the plan's beats reference + last ~500 words of the prior chapter (style continuity) + user direction. Plain streamed **Traditional Chinese** text output. Regeneration starts fresh from plan + instructions rather than patching previous prose, to keep prompts cheap.
- **Rolling summary update** (on finalize): existing summary + the newly finalized chapter's full text (bounded since it's one chapter) → instructed to produce a compressed ~400-600 word (Traditional Chinese) updated summary, preserving open threads/character states. `token_budget.py` should account for Chinese text being denser per character than English (~1.5-2 chars/token, not ~4) when truncating.

### Notes

No auth means no CSRF/session concerns to design around, but the app should still not be exposed to the open internet without the operator putting it behind their own access control (reverse proxy + basic auth, VPN, etc.) — worth a one-line README callout since the API has zero built-in access control by design. Never log the OpenRouter key. `data/` (the SQLite file) gitignored and Docker-volume-mounted so it isn't lost on rebuilds. `docker-compose.yml` sets `extra_hosts: host.docker.internal:host-gateway` so the container can reach a local Ollama on the Docker host even on native Linux (Docker Desktop on Mac/Windows resolves that hostname automatically; native Linux Docker doesn't, without this entry).

## Phased build order

1. **Foundations**: `frontend/` (Vite, via `pnpm`) + `backend/` (FastAPI, via `uv`) scaffolding, single DB engine + schema/migrations, Novels + Entities CRUD end-to-end through the UI, Settings page (API key + model picker, including free-model choices for Chinese quality). Verify via a smoke script (`backend/scripts/smoke.py`, `httpx`) hitting the running dev server, plus manual click-through.
2. **Entity AI chat**: OpenRouter client (streaming via httpx), entity-improve prompt builder, chat persistence + SSE endpoint + apply-patch endpoint, `EntityChatPanel` UI. Support an `LLM_MOCK=1` env flag so the pipeline is testable without a real key. Verify: send a chat message, confirm persisted response and that accepting a patch mutates `fields_json`.
3. **Chapter planning**: chapters CRUD, plan prompt builder + generate/regenerate/approve endpoints with pydantic validation + retry, `ChapterPlanPage` UI. Verify: generate → edit → approve; confirm prose generation is rejected pre-approval and allowed after.
4. **Chapter prose + rolling summary**: prose prompt builder, SSE generate/regenerate, manual edit, finalize → summary update, `ChapterProsePage` UI. Verify: plan → approve → generate prose → status transitions to drafted → finalize → status final and `rolling_summary` changed and stays bounded in length.
5. **Docker packaging + polish**: multi-stage Dockerfile (pnpm build frontend → copy into uv/FastAPI image), `docker-compose.yml` with a data volume, typed error handling for OpenRouter failures (invalid key/rate-limited/upstream), stop-generation abort wiring, revisions UI, loading/empty states. Verify: `docker compose up` from a clean checkout serves the app on one port, data persists across `docker compose down && up`, and a manual end-to-end run of a 2-3 chapter toy novel against a real free OpenRouter model in Traditional Chinese confirms the rolling summary carries continuity into later chapters' plans.

## Critical files

- `backend/app/db/engine.py` — single SQLite engine setup (WAL mode, path from config)
- `backend/app/db/schema.sql` — full data model
- `backend/app/llm/llm_client.py` — streaming/non-streaming HTTP integration + error mapping, shared by both providers
- `backend/app/llm/provider_config.py` — resolves the `settings` row into a provider-agnostic `ProviderConfig`
- `backend/app/llm/prompts/{chapter_plan,chapter_prose,rolling_summary}.py` — the context-budgeting + Traditional Chinese output logic
- `backend/app/routers/chapter_prose.py` — ties together approval gating, SSE streaming, status transitions, finalize→summary update
- `Dockerfile`, `docker-compose.yml` — multi-stage build + single-port deployment with persistent data volume

## Verification

Each phase has its own smoke-test/manual check (above). The end-to-end acceptance test is Phase 5's manual run: `docker compose up`, create a novel, build a few entities, improve one via chat, plan→approve→generate→finalize 2-3 chapters in Traditional Chinese using a real free OpenRouter model and the user's own key, confirm chapter 3's generated plan visibly reflects events from chapter 1 via the rolling summary, and confirm the SQLite data survives a container restart.
