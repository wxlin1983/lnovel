# lnovel

AI-assisted novel writing app: build structured worldbuilding (characters/locations/
storylines), refine entities by chatting with an LLM, review and approve an
LLM-generated chapter beat-plan, then generate chapter prose from that plan — aiming
to cover a full book-length novel despite using small-context free OpenRouter models.

Single-user, no accounts. See `docs/design.md` for the full design.

## Running

```
docker compose up --build
```

Then open `http://localhost:8000`, go to Settings, and enter your own OpenRouter API
key (https://openrouter.ai). Novel content is generated mostly in Traditional Chinese
(繁體中文); UI chrome is English.

Data lives in a Docker volume (`lnovel-data`, mounted at `/app/data`) and persists
across `docker compose down && docker compose up`.

## Security

This app has **no authentication** by design — it's meant for a single user running
their own container. The API is open to whoever can reach the container's port. Do not
expose it to the open internet without putting it behind your own access control (a
reverse proxy with basic auth, a VPN, etc.).

## Development

- `backend/` — FastAPI + SQLAlchemy Core over SQLite, managed with `uv`. Set
  `LNOVEL_LLM_MOCK=1` to exercise the OpenRouter-backed endpoints without a real key.
  Smoke scripts live in `backend/scripts/`.
- `frontend/` — React + Vite + TS, managed with `pnpm`. `pnpm run dev` proxies `/api`
  to a backend running on `:8000` (see `vite.config.ts`).
