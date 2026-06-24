"""Lists models currently pulled in a local Ollama instance."""

import httpx

from app.config import settings

_MOCK_OLLAMA_MODELS: list[dict] = [
    {"id": "llama3.1:8b", "name": "llama3.1:8b", "context_length": None},
    {"id": "qwen2.5:7b", "name": "qwen2.5:7b", "context_length": None},
]


async def list_ollama_models(base_url: str) -> list[dict]:
    """Returns locally-installed Ollama models as [{id, name, context_length}].

    Not cached: this is a local, cheap call and the set changes whenever the user
    pulls/removes a model, so caching would only add staleness risk.
    """
    if settings.llm_mock:
        return _MOCK_OLLAMA_MODELS

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(f"{base_url.rstrip('/')}/api/tags")
    response.raise_for_status()
    data = response.json().get("models", [])
    return [{"id": m["name"], "name": m["name"], "context_length": None} for m in data]


async def ollama_model_ids(base_url: str) -> list[str]:
    return [m["id"] for m in await list_ollama_models(base_url)]
