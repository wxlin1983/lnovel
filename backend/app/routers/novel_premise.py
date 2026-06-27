import json

from fastapi import APIRouter, Depends
from sqlalchemy import Connection, text

from app.deps import get_db
from app.llm.llm_client import complete_chat_with_fallback
from app.llm.prompts.premise_generate import build_messages, build_revise_messages
from app.llm.provider_config import load_provider_config
from app.routers.novels import _require_novel, _row_to_novel
from app.schemas.novel_premise import PremiseGenerateRequest, PremiseReviseRequest, PremiseProposal
from app.schemas.novels import Novel

router = APIRouter(prefix="/api/novels/{novel_id}/premise", tags=["novel_premise"])


def _save_premise_and_chat(db: Connection, novel_id: str, premise: str, chat: list[dict]) -> None:
    db.execute(
        text(
            "UPDATE novels SET premise = :p, premise_chat_json = :c, updated_at = datetime('now') WHERE id = :id"
        ),
        {"p": premise, "c": json.dumps(chat, ensure_ascii=False), "id": novel_id},
    )
    db.commit()


@router.post("/generate", response_model=Novel)
async def generate_premise(
    novel_id: str, payload: PremiseGenerateRequest, db: Connection = Depends(get_db)
) -> Novel:
    novel_row = _require_novel(db, novel_id)

    if payload.inspiration is not None:
        db.execute(
            text("UPDATE novels SET inspiration = :v, updated_at = datetime('now') WHERE id = :id"),
            {"v": payload.inspiration, "id": novel_id},
        )
        db.commit()
        novel_row = _require_novel(db, novel_id)

    cfg = load_provider_config(db)
    # Generate fresh from inspiration only — don't pass existing_premise so the AI
    # isn't biased toward extending old content when the user wants a new direction.
    messages = build_messages(inspiration=novel_row.inspiration)
    proposed = (await complete_chat_with_fallback(cfg, messages)).strip()

    user_turn = {"role": "user", "content": f"靈感：{novel_row.inspiration or '（未提供）'}"}
    assistant_turn = {"role": "assistant", "content": proposed}
    _save_premise_and_chat(db, novel_id, proposed, [user_turn, assistant_turn])
    return _row_to_novel(_require_novel(db, novel_id))


@router.post("/revise", response_model=Novel)
async def revise_premise(
    novel_id: str, payload: PremiseReviseRequest, db: Connection = Depends(get_db)
) -> Novel:
    novel_row = _require_novel(db, novel_id)
    existing_chat: list[dict] = json.loads(novel_row.premise_chat_json)

    cfg = load_provider_config(db)
    messages = build_revise_messages(chat_history=existing_chat, new_message=payload.message)
    proposed = (await complete_chat_with_fallback(cfg, messages)).strip()

    updated_chat = [
        *existing_chat,
        {"role": "user", "content": payload.message},
        {"role": "assistant", "content": proposed},
    ]
    _save_premise_and_chat(db, novel_id, proposed, updated_chat)
    return _row_to_novel(_require_novel(db, novel_id))
