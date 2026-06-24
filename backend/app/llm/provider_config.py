"""Resolves the persisted `settings` row into a provider-agnostic config the LLM
client can use, centralizing what used to be duplicated read+validate logic across
every chapter-plan/chapter-prose/entity-chat call site."""

from collections.abc import Awaitable, Callable
from dataclasses import dataclass

from fastapi import HTTPException
from sqlalchemy import Connection, text

from app.llm.model_catalog import free_model_ids
from app.llm.ollama_catalog import ollama_model_ids

OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"


@dataclass(frozen=True)
class ProviderConfig:
    endpoint_url: str
    api_key: str | None
    model: str
    fallback_status: int
    list_fallback_candidates: Callable[[], Awaitable[list[str]]]


def load_provider_config(db: Connection) -> ProviderConfig:
    row = db.execute(
        text(
            "SELECT provider, openrouter_api_key, preferred_model, ollama_base_url "
            "FROM settings WHERE id = 1"
        )
    ).one()

    if row.provider == "ollama":
        base = row.ollama_base_url.rstrip("/")
        return ProviderConfig(
            endpoint_url=f"{base}/v1/chat/completions",
            api_key=None,
            model=row.preferred_model,
            fallback_status=404,
            list_fallback_candidates=lambda: ollama_model_ids(row.ollama_base_url),
        )

    if not row.openrouter_api_key:
        raise HTTPException(status_code=400, detail="尚未設定 OpenRouter API 金鑰")
    return ProviderConfig(
        endpoint_url=OPENROUTER_ENDPOINT,
        api_key=row.openrouter_api_key,
        model=row.preferred_model,
        fallback_status=402,
        list_fallback_candidates=free_model_ids,
    )
