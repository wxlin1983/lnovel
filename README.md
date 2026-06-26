# lnovel

AI-assisted novel writing app: build structured worldbuilding (characters/locations/
storylines), refine entities by chatting with an LLM, review and approve an
LLM-generated chapter beat-plan, then generate chapter prose from that plan — aiming
to cover a full book-length novel despite using small-context free models.

Single-user, no accounts. See `docs/design.md` for the full design.

## Running

```
docker compose up --build
```

Then open `http://localhost:8000` and go to Settings to choose an AI provider:

- **OpenRouter** (default): enter your own API key (https://openrouter.ai). The model
  dropdown lists OpenRouter's current free-tier models; if your chosen model ever
  reports it needs payment, the app automatically retries with another free model.
- **Local Ollama**: no API key needed. Install [Ollama](https://ollama.com), run
  `ollama serve`, pull at least one model (e.g. `ollama pull qwen2.5:1.5b-instruct`),
  then switch the provider to Ollama in Settings. The default base URL,
  `http://host.docker.internal:11434`, reaches Ollama running on the same machine as
  the Docker host (the bundled `docker-compose.yml` maps that hostname for you, so
  this works out of the box on Linux too, not just Docker Desktop). The model dropdown
  lists your locally-pulled models; if the selected one isn't pulled, the app
  automatically retries with another one you have installed.

  **Model recommendation for CPU-only machines** (no GPU): pick a small, non-"thinking"
  instruct model — `qwen2.5:1.5b-instruct` or `qwen2.5:3b-instruct` are good defaults,
  with strong Traditional Chinese quality for their size and no hidden reasoning step.
  Avoid "thinking"-capable models (e.g. the `qwen3`/`qwen3.5` family) on CPU-only
  hardware — they generate a large hidden reasoning chain before any visible output,
  which on something like an Intel N100 can take many minutes per request even at 4B
  parameters. If you have a GPU, larger/thinking models are much more practical.

  **Troubleshooting "connection timed out" from the app to Ollama on Linux**: Ollama
  must listen on `0.0.0.0`, not just `127.0.0.1` (check with `ss -tlnp | grep 11434`;
  if needed, set `Environment="OLLAMA_HOST=0.0.0.0:11434"` in a systemd override and
  restart). If you run `ufw`, its default-deny incoming policy also blocks traffic
  from the Docker bridge to the host — allow it with
  `sudo ufw allow from 172.17.0.0/16 to any port 11434 proto tcp` (and repeat for your
  compose project's bridge subnet, e.g. `172.19.0.0/16`, found via
  `docker network inspect <project>_default`).

Novel content and UI chrome are both in Traditional Chinese (繁體中文).

Data lives in a Docker volume (`lnovel-data`, mounted at `/app/data`) and persists
across `docker compose down && docker compose up`.

## Security

This app has **no authentication** by design — it's meant for a single user running
their own container. The API is open to whoever can reach the container's port. Do not
expose it to the open internet without putting it behind your own access control (a
reverse proxy with basic auth, a VPN, etc.).

## Development

- `backend/` — FastAPI + SQLAlchemy Core over SQLite, managed with `uv`. Set
  `LNOVEL_LLM_MOCK=1` to exercise the AI-backed endpoints without a real key or a
  running Ollama. Smoke scripts live in `backend/scripts/`.
- `frontend/` — React + Vite + TS, managed with `pnpm`. `pnpm run dev` proxies `/api`
  to a backend running on `:8000` (see `vite.config.ts`).
