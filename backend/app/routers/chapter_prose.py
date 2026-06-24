import json
import uuid
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import Connection, text
from sse_starlette import EventSourceResponse

from app.deps import get_db
from app.llm.openrouter_client import OpenRouterError, complete_chat, stream_chat_completion
from app.llm.prompts.chapter_prose import build_messages as build_prose_messages
from app.llm.prompts.rolling_summary import build_messages as build_summary_messages
from app.llm.token_budget import truncate_chars
from app.routers.chapters import _require_chapter, _row_to_chapter
from app.schemas.chapter_prose import ChapterRevision, ProseGenerateRequest, ProseUpdateRequest
from app.schemas.chapters import Chapter

router = APIRouter(prefix="/api/novels/{novel_id}/chapters/{chapter_id}/prose", tags=["chapter_prose"])

PREVIOUS_PROSE_EXCERPT_CHARS = 600
ROLLING_SUMMARY_INPUT_CAP_CHARS = 8000


def _require_approved_plan(chapter_row) -> None:
    if not chapter_row.plan_json or not chapter_row.plan_approved_at:
        raise HTTPException(status_code=400, detail="章節大綱尚未核准，無法生成正文")


def _gather_prose_context(db: Connection, novel_id: str, chapter_row):
    novel = db.execute(text("SELECT * FROM novels WHERE id = :id"), {"id": novel_id}).one()
    plan = json.loads(chapter_row.plan_json)
    tagged_ids = set(json.loads(chapter_row.relevant_entity_ids_json))

    entity_rows = db.execute(
        text("SELECT * FROM entities WHERE novel_id = :novel_id"), {"novel_id": novel_id}
    ).all()
    entities_detail = [{"name": e.name, "description": e.description} for e in entity_rows if e.id in tagged_ids]

    previous_row = db.execute(
        text("SELECT * FROM chapters WHERE novel_id = :novel_id AND chapter_number = :n"),
        {"novel_id": novel_id, "n": chapter_row.chapter_number - 1},
    ).one_or_none()
    previous_prose_excerpt = None
    if previous_row is not None and previous_row.prose:
        previous_prose_excerpt = truncate_chars(previous_row.prose, PREVIOUS_PROSE_EXCERPT_CHARS)

    return novel, plan["beats"], entities_detail, previous_prose_excerpt


def _generate_prose_response(
    novel_id: str, chapter_id: str, payload: ProseGenerateRequest, db: Connection
) -> EventSourceResponse:
    chapter_row = _require_chapter(db, novel_id, chapter_id)
    _require_approved_plan(chapter_row)

    if payload.user_direction is not None:
        db.execute(
            text("UPDATE chapters SET user_direction = :v WHERE id = :id"),
            {"v": payload.user_direction, "id": chapter_id},
        )
        db.commit()
        chapter_row = _require_chapter(db, novel_id, chapter_id)

    settings_row = db.execute(
        text("SELECT openrouter_api_key, preferred_model FROM settings WHERE id = 1")
    ).one()
    if not settings_row.openrouter_api_key:
        raise HTTPException(status_code=400, detail="尚未設定 OpenRouter API 金鑰")

    novel, beats, entities_detail, previous_prose_excerpt = _gather_prose_context(db, novel_id, chapter_row)
    messages = build_prose_messages(
        novel_premise=novel.premise,
        rolling_summary=novel.rolling_summary,
        beats=beats,
        entities_detail=entities_detail,
        previous_prose_excerpt=previous_prose_excerpt,
        user_direction=chapter_row.user_direction,
    )
    model = settings_row.preferred_model
    api_key = settings_row.openrouter_api_key

    async def event_generator() -> AsyncIterator[dict[str, str]]:
        accumulated = ""
        try:
            async for chunk in stream_chat_completion(api_key=api_key, model=model, messages=messages):
                accumulated += chunk
                yield {"event": "delta", "data": chunk}
        except OpenRouterError as exc:
            yield {"event": "error", "data": exc.message}
            return

        db.execute(
            text("INSERT INTO chapter_prose_revisions (id, chapter_id, prose) VALUES (:id, :chapter_id, :prose)"),
            {"id": uuid.uuid4().hex, "chapter_id": chapter_id, "prose": accumulated},
        )
        db.execute(
            text(
                "UPDATE chapters SET prose = :prose, status = 'drafted', updated_at = datetime('now') "
                "WHERE id = :id"
            ),
            {"prose": accumulated, "id": chapter_id},
        )
        db.commit()
        yield {"event": "done", "data": json.dumps({"prose": accumulated}, ensure_ascii=False)}

    return EventSourceResponse(event_generator())


@router.post("")
def generate_prose(
    novel_id: str, chapter_id: str, payload: ProseGenerateRequest, db: Connection = Depends(get_db)
) -> EventSourceResponse:
    return _generate_prose_response(novel_id, chapter_id, payload, db)


@router.post("/regenerate")
def regenerate_prose(
    novel_id: str, chapter_id: str, payload: ProseGenerateRequest, db: Connection = Depends(get_db)
) -> EventSourceResponse:
    return _generate_prose_response(novel_id, chapter_id, payload, db)


@router.put("", response_model=Chapter)
def update_prose(
    novel_id: str, chapter_id: str, payload: ProseUpdateRequest, db: Connection = Depends(get_db)
) -> Chapter:
    chapter_row = _require_chapter(db, novel_id, chapter_id)
    db.execute(
        text("INSERT INTO chapter_prose_revisions (id, chapter_id, prose) VALUES (:id, :chapter_id, :prose)"),
        {"id": uuid.uuid4().hex, "chapter_id": chapter_id, "prose": payload.prose},
    )
    new_status = "final" if chapter_row.status == "final" else "drafted"
    db.execute(
        text("UPDATE chapters SET prose = :prose, status = :status, updated_at = datetime('now') WHERE id = :id"),
        {"prose": payload.prose, "status": new_status, "id": chapter_id},
    )
    db.commit()
    row = db.execute(text("SELECT * FROM chapters WHERE id = :id"), {"id": chapter_id}).one()
    return _row_to_chapter(row)


@router.post("/finalize", response_model=Chapter)
async def finalize_chapter(novel_id: str, chapter_id: str, db: Connection = Depends(get_db)) -> Chapter:
    chapter_row = _require_chapter(db, novel_id, chapter_id)
    if not chapter_row.prose:
        raise HTTPException(status_code=400, detail="本章尚無正文，無法定稿")

    settings_row = db.execute(
        text("SELECT openrouter_api_key, preferred_model FROM settings WHERE id = 1")
    ).one()
    if not settings_row.openrouter_api_key:
        raise HTTPException(status_code=400, detail="尚未設定 OpenRouter API 金鑰")

    novel = db.execute(text("SELECT * FROM novels WHERE id = :id"), {"id": novel_id}).one()
    bounded_prose = truncate_chars(chapter_row.prose, ROLLING_SUMMARY_INPUT_CAP_CHARS)
    messages = build_summary_messages(existing_summary=novel.rolling_summary, finalized_chapter_text=bounded_prose)

    try:
        new_summary = await complete_chat(
            api_key=settings_row.openrouter_api_key, model=settings_row.preferred_model, messages=messages
        )
    except OpenRouterError as exc:
        raise HTTPException(status_code=502, detail=exc.message) from exc

    db.execute(
        text("UPDATE novels SET rolling_summary = :s, updated_at = datetime('now') WHERE id = :id"),
        {"s": new_summary.strip(), "id": novel_id},
    )
    db.execute(
        text("UPDATE chapters SET status = 'final', updated_at = datetime('now') WHERE id = :id"),
        {"id": chapter_id},
    )
    db.commit()

    row = db.execute(text("SELECT * FROM chapters WHERE id = :id"), {"id": chapter_id}).one()
    return _row_to_chapter(row)


@router.get("/revisions", response_model=list[ChapterRevision])
def list_prose_revisions(novel_id: str, chapter_id: str, db: Connection = Depends(get_db)) -> list[ChapterRevision]:
    _require_chapter(db, novel_id, chapter_id)
    rows = db.execute(
        text("SELECT * FROM chapter_prose_revisions WHERE chapter_id = :chapter_id ORDER BY created_at DESC"),
        {"chapter_id": chapter_id},
    ).all()
    return [
        ChapterRevision(id=r.id, chapter_id=r.chapter_id, content=r.prose, created_at=r.created_at) for r in rows
    ]
