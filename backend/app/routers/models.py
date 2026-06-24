from fastapi import APIRouter, Depends
from sqlalchemy import Connection, text

from app.deps import get_db
from app.llm.model_catalog import list_free_models
from app.llm.ollama_catalog import list_ollama_models
from app.schemas.models import ModelOption
from app.schemas.settings import Provider

router = APIRouter(prefix="/api/models", tags=["models"])


@router.get("", response_model=list[ModelOption])
async def get_models(
    provider: Provider | None = None,
    ollama_base_url: str | None = None,
    db: Connection = Depends(get_db),
) -> list[dict]:
    """Lists models for `provider` if given, else for whichever provider is currently saved.
    `provider` lets the Settings page live-preview the model list when the user switches
    providers. `ollama_base_url` is only meant for an explicit "test connection" action (not
    refetched on every keystroke while editing the base URL field) — when given, it overrides
    the persisted base URL so the user can verify a candidate address before saving it.
    """
    row = db.execute(text("SELECT provider, ollama_base_url FROM settings WHERE id = 1")).one()
    effective_provider = provider or row.provider
    if effective_provider == "ollama":
        return await list_ollama_models(ollama_base_url or row.ollama_base_url)
    return await list_free_models()
