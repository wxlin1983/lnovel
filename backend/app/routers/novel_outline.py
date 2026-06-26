import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError
from sqlalchemy import Connection, text

from app.deps import get_db
from app.llm.code_fence import strip_code_fence
from app.llm.llm_client import LLMError, complete_chat_with_fallback
from app.llm.prompts.book_outline import build_messages
from app.llm.provider_config import load_provider_config
from app.routers.novels import _require_novel, _row_to_novel
from app.schemas.novel_outline import OutlineContent, OutlineGenerateRequest, OutlineUpdateRequest
from app.schemas.novels import Novel

router = APIRouter(prefix="/api/novels/{novel_id}/outline", tags=["novel_outline"])


def _gather_storylines(db: Connection, novel_id: str) -> list[dict[str, str]]:
    rows = db.execute(
        text("SELECT name, description FROM entities WHERE novel_id = :novel_id AND type = 'storyline'"),
        {"novel_id": novel_id},
    ).all()
    return [{"name": r.name, "description": r.description} for r in rows]


def _save_outline(db: Connection, novel_id: str, outline: OutlineContent) -> None:
    outline_json = json.dumps([c.model_dump() for c in outline.chapters], ensure_ascii=False)
    db.execute(
        text("UPDATE novels SET book_outline_json = :v, updated_at = datetime('now') WHERE id = :id"),
        {"v": outline_json, "id": novel_id},
    )
    db.commit()


@router.post("/generate", response_model=Novel)
async def generate_outline(
    novel_id: str, payload: OutlineGenerateRequest, db: Connection = Depends(get_db)
) -> Novel:
    novel_row = _require_novel(db, novel_id)
    cfg = load_provider_config(db)
    storylines = _gather_storylines(db, novel_id)
    messages = build_messages(
        premise=novel_row.premise,
        inspiration=novel_row.inspiration,
        storylines=storylines,
        chapter_count=payload.chapter_count,
        user_direction=payload.user_direction,
    )

    last_error: Exception | None = None
    for _ in range(2):
        try:
            raw = await complete_chat_with_fallback(cfg, messages)
            outline = OutlineContent.model_validate_json(strip_code_fence(raw))
            _save_outline(db, novel_id, outline)
            return _row_to_novel(_require_novel(db, novel_id))
        except (ValidationError, json.JSONDecodeError) as exc:
            last_error = exc
            continue
        except LLMError:
            raise

    raise HTTPException(status_code=502, detail=f"AI 回傳的章節規劃格式錯誤：{last_error}")


@router.put("", response_model=Novel)
def update_outline(novel_id: str, payload: OutlineUpdateRequest, db: Connection = Depends(get_db)) -> Novel:
    _require_novel(db, novel_id)
    _save_outline(db, novel_id, OutlineContent(chapters=payload.chapters))
    return _row_to_novel(_require_novel(db, novel_id))
