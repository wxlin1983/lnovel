"""Fetches and caches OpenRouter's list of free-tier (no-cost) models."""

import time

import httpx

from app.config import settings

OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models"

_CACHE_TTL_SECONDS = 3600.0
_cache: list[dict] | None = None
_cache_at: float = 0.0

_MOCK_FREE_MODELS: list[dict] = [
    {"id": "qwen/qwen-2.5-72b-instruct:free", "name": "Qwen2.5 72B Instruct (free)", "context_length": 32768},
    {"id": "meta-llama/llama-3.1-8b-instruct:free", "name": "Llama 3.1 8B Instruct (free)", "context_length": 131072},
    {"id": "google/gemma-2-9b-it:free", "name": "Gemma 2 9B IT (free)", "context_length": 8192},
    {"id": "mistralai/mistral-7b-instruct:free", "name": "Mistral 7B Instruct (free)", "context_length": 32768},
]


def _is_free(model: dict) -> bool:
    pricing = model.get("pricing", {})
    return pricing.get("prompt") == "0" and pricing.get("completion") == "0"


async def list_free_models() -> list[dict]:
    """Returns free-tier OpenRouter models as [{id, name, context_length}], cached for an hour."""
    global _cache, _cache_at

    if settings.llm_mock:
        return _MOCK_FREE_MODELS

    now = time.monotonic()
    if _cache is not None and now - _cache_at < _CACHE_TTL_SECONDS:
        return _cache

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(OPENROUTER_MODELS_URL)
    response.raise_for_status()
    data = response.json().get("data", [])

    free = [
        {"id": m["id"], "name": m.get("name", m["id"]), "context_length": m.get("context_length")}
        for m in data
        if _is_free(m)
    ]
    _cache = free
    _cache_at = now
    return free


async def free_model_ids() -> list[str]:
    return [m["id"] for m in await list_free_models()]
