from fastapi import APIRouter

from app.llm.model_catalog import list_free_models
from app.schemas.models import FreeModel

router = APIRouter(prefix="/api/models", tags=["models"])


@router.get("/free", response_model=list[FreeModel])
async def get_free_models() -> list[dict]:
    return await list_free_models()
