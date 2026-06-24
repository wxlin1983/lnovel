from fastapi import APIRouter, Depends
from sqlalchemy import Connection, text

from app.deps import get_db
from app.llm.model_catalog import list_free_models
from app.llm.ollama_catalog import list_ollama_models
from app.schemas.models import ModelOption
from app.schemas.settings import Provider

router = APIRouter(prefix="/api/models", tags=["models"])


@router.get("", response_model=list[ModelOption])
async def get_models(provider: Provider | None = None, db: Connection = Depends(get_db)) -> list[dict]:
    """Lists models for `provider` if given, else for whichever provider is currently saved.
    Letting the caller override just `provider` (not the Ollama base URL) lets the Settings
    page live-preview the model list when the user switches providers, without refetching on
    every keystroke while they're editing the base URL.
    """
    row = db.execute(text("SELECT provider, ollama_base_url FROM settings WHERE id = 1")).one()
    effective_provider = provider or row.provider
    if effective_provider == "ollama":
        return await list_ollama_models(row.ollama_base_url)
    return await list_free_models()
