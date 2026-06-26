from fastapi import APIRouter, Depends
from sqlalchemy import Connection, text

from app.deps import get_db
from app.llm.llm_client import complete_chat_with_fallback
from app.llm.prompts.premise_generate import build_messages
from app.llm.provider_config import load_provider_config
from app.routers.novels import _require_novel
from app.schemas.novel_premise import PremiseGenerateRequest, PremiseProposal

router = APIRouter(prefix="/api/novels/{novel_id}/premise", tags=["novel_premise"])


@router.post("/generate", response_model=PremiseProposal)
async def generate_premise(
    novel_id: str, payload: PremiseGenerateRequest, db: Connection = Depends(get_db)
) -> PremiseProposal:
    novel_row = _require_novel(db, novel_id)

    if payload.inspiration is not None:
        db.execute(
            text("UPDATE novels SET inspiration = :v, updated_at = datetime('now') WHERE id = :id"),
            {"v": payload.inspiration, "id": novel_id},
        )
        db.commit()
        novel_row = _require_novel(db, novel_id)

    cfg = load_provider_config(db)
    messages = build_messages(inspiration=novel_row.inspiration, existing_premise=novel_row.premise)
    proposed = await complete_chat_with_fallback(cfg, messages)
    return PremiseProposal(premise=proposed.strip())
