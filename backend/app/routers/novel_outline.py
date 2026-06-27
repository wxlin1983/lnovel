import json
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError
from sqlalchemy import Connection, text

from app.deps import get_db
from app.llm.code_fence import strip_code_fence
from app.llm.json_schema import json_schema_response_format
from app.llm.llm_client import LLMError, complete_chat_with_fallback
from app.llm.prompts.book_outline import build_messages, build_revise_messages
from app.llm.provider_config import load_provider_config
from app.routers.novels import _require_novel, _row_to_novel
from app.schemas.novel_outline import OutlineContent, OutlineGenerateRequest, OutlineReviseRequest, OutlineUpdateRequest
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


def _append_outline_chat(db: Connection, novel_id: str, user_msg: str, assistant_msg: str) -> None:
    row = db.execute(text("SELECT outline_chat_json FROM novels WHERE id = :id"), {"id": novel_id}).one()
    chat: list[dict] = json.loads(row.outline_chat_json)
    chat.append({"role": "user", "content": user_msg})
    chat.append({"role": "assistant", "content": assistant_msg})
    db.execute(
        text("UPDATE novels SET outline_chat_json = :v WHERE id = :id"),
        {"v": json.dumps(chat, ensure_ascii=False), "id": novel_id},
    )
    db.commit()


async def _call_outline_llm(
    cfg, messages: list[dict], chapter_count: int | None = None
) -> OutlineContent:
    kwargs = {}
    if chapter_count is not None:
        kwargs["response_format"] = json_schema_response_format(
            OutlineContent, name="outline", array_field="chapters", exact_count=chapter_count
        )
    last_error: Exception | None = None
    for _ in range(2):
        try:
            raw = await complete_chat_with_fallback(cfg, messages, **kwargs)
            return OutlineContent.model_validate_json(strip_code_fence(raw))
        except (ValidationError, json.JSONDecodeError) as exc:
            last_error = exc
            continue
        except LLMError:
            raise
    raise HTTPException(status_code=502, detail=f"AI 回傳的章節規劃格式錯誤：{last_error}")


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
    outline = await _call_outline_llm(cfg, messages, chapter_count=payload.chapter_count)
    _save_outline(db, novel_id, outline)
    user_msg = f"請規劃全書共 {payload.chapter_count} 章" + (f"，{payload.user_direction}" if payload.user_direction else "")
    _append_outline_chat(db, novel_id, user_msg, f"已生成 {len(outline.chapters)} 章架構")
    return _row_to_novel(_require_novel(db, novel_id))


@router.post("/revise", response_model=Novel)
async def revise_outline(
    novel_id: str, payload: OutlineReviseRequest, db: Connection = Depends(get_db)
) -> Novel:
    novel_row = _require_novel(db, novel_id)
    if not novel_row.book_outline_json or novel_row.book_outline_json == "[]":
        raise HTTPException(status_code=400, detail="尚未生成全書架構，請先使用 /generate")

    cfg = load_provider_config(db)
    messages = build_revise_messages(
        premise=novel_row.premise,
        current_outline_json=novel_row.book_outline_json,
        message=payload.message,
    )
    outline = await _call_outline_llm(cfg, messages)
    _save_outline(db, novel_id, outline)
    _append_outline_chat(db, novel_id, payload.message, f"已根據意見更新架構（{len(outline.chapters)} 章）")
    return _row_to_novel(_require_novel(db, novel_id))


@router.put("", response_model=Novel)
def update_outline(novel_id: str, payload: OutlineUpdateRequest, db: Connection = Depends(get_db)) -> Novel:
    _require_novel(db, novel_id)
    _save_outline(db, novel_id, OutlineContent(chapters=payload.chapters))
    return _row_to_novel(_require_novel(db, novel_id))


@router.post("/apply", status_code=204)
def apply_outline(novel_id: str, db: Connection = Depends(get_db)) -> None:
    """Delete all existing chapters and recreate from current book_outline_json."""
    novel_row = _require_novel(db, novel_id)
    outline: list[dict] = json.loads(novel_row.book_outline_json)
    if not outline:
        raise HTTPException(status_code=400, detail="尚未生成全書架構")

    db.execute(text("DELETE FROM chapters WHERE novel_id = :id"), {"id": novel_id})
    for entry in outline:
        db.execute(
            text(
                "INSERT INTO chapters (id, novel_id, chapter_number, title, user_direction) "
                "VALUES (:id, :novel_id, :chapter_number, :title, :user_direction)"
            ),
            {
                "id": uuid.uuid4().hex,
                "novel_id": novel_id,
                "chapter_number": entry["chapter_number"],
                "title": entry["title"],
                "user_direction": entry["summary"],
            },
        )
    db.commit()
