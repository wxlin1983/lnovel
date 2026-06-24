import json
import re
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError
from sqlalchemy import Connection, text

from app.deps import get_db
from app.llm.openrouter_client import OpenRouterError, complete_chat_with_fallback
from app.llm.prompts.chapter_plan import build_messages
from app.routers.chapters import _require_chapter, _row_to_chapter
from app.schemas.chapter_plan import ChapterPlanContent, PlanGenerateRequest, PlanUpdateRequest
from app.schemas.chapters import Chapter

router = APIRouter(prefix="/api/novels/{novel_id}/chapters/{chapter_id}/plan", tags=["chapter_plan"])

CODE_FENCE_RE = re.compile(r"^```(?:json)?\s*\n(.*?)\n```$", re.DOTALL)


def _strip_code_fence(text_: str) -> str:
    match = CODE_FENCE_RE.match(text_.strip())
    return match.group(1) if match else text_.strip()


def _gather_plan_context(db: Connection, novel_id: str, chapter_row):
    novel = db.execute(text("SELECT * FROM novels WHERE id = :id"), {"id": novel_id}).one()
    tagged_ids = set(json.loads(chapter_row.relevant_entity_ids_json))

    entity_rows = db.execute(
        text("SELECT * FROM entities WHERE novel_id = :novel_id"), {"novel_id": novel_id}
    ).all()

    storylines = []
    characters = []
    for e in entity_rows:
        if e.type == "storyline":
            storylines.append({"name": e.name, "description": e.description})
        elif e.type == "character":
            fields = json.loads(e.fields_json)
            if e.id in tagged_ids:
                characters.append({"name": e.name, "role": fields.get("role", ""), "description": e.description})
            else:
                characters.append({"name": e.name, "role": fields.get("role", "")})

    previous_row = db.execute(
        text("SELECT * FROM chapters WHERE novel_id = :novel_id AND chapter_number = :n"),
        {"novel_id": novel_id, "n": chapter_row.chapter_number - 1},
    ).one_or_none()

    previous_plan_summary = None
    previous_prose_excerpt = None
    if previous_row is not None:
        if previous_row.plan_json:
            plan = json.loads(previous_row.plan_json)
            previous_plan_summary = "；".join(b["title"] for b in plan.get("beats", []))
        if previous_row.prose:
            previous_prose_excerpt = previous_row.prose[-500:]

    return novel, storylines, characters, previous_plan_summary, previous_prose_excerpt


async def _generate_plan_content(db: Connection, novel_id: str, chapter_row) -> dict:
    settings_row = db.execute(
        text("SELECT openrouter_api_key, preferred_model FROM settings WHERE id = 1")
    ).one()
    if not settings_row.openrouter_api_key:
        raise HTTPException(status_code=400, detail="尚未設定 OpenRouter API 金鑰")

    novel, storylines, characters, previous_plan_summary, previous_prose_excerpt = _gather_plan_context(
        db, novel_id, chapter_row
    )
    messages = build_messages(
        novel_premise=novel.premise,
        rolling_summary=novel.rolling_summary,
        chapter_number=chapter_row.chapter_number,
        previous_plan_summary=previous_plan_summary,
        previous_prose_excerpt=previous_prose_excerpt,
        storylines=storylines,
        characters=characters,
        user_direction=chapter_row.user_direction,
    )

    last_error: Exception | None = None
    for _ in range(2):
        try:
            raw = await complete_chat_with_fallback(
                api_key=settings_row.openrouter_api_key, model=settings_row.preferred_model, messages=messages
            )
            plan = ChapterPlanContent.model_validate_json(_strip_code_fence(raw))
            return plan.model_dump()
        except (ValidationError, json.JSONDecodeError) as exc:
            last_error = exc
            continue
        except OpenRouterError:
            raise

    raise HTTPException(status_code=502, detail=f"AI 回傳的章節大綱格式錯誤：{last_error}")


def _save_plan(db: Connection, chapter_id: str, plan: dict) -> None:
    plan_json = json.dumps(plan, ensure_ascii=False)
    db.execute(
        text(
            "INSERT INTO chapter_plan_revisions (id, chapter_id, plan_json) VALUES (:id, :chapter_id, :plan_json)"
        ),
        {"id": uuid.uuid4().hex, "chapter_id": chapter_id, "plan_json": plan_json},
    )
    db.execute(
        text(
            "UPDATE chapters SET plan_json = :plan_json, plan_approved_at = NULL, updated_at = datetime('now') "
            "WHERE id = :id"
        ),
        {"plan_json": plan_json, "id": chapter_id},
    )
    db.commit()


async def _generate_and_save(novel_id: str, chapter_id: str, payload: PlanGenerateRequest, db: Connection) -> Chapter:
    chapter_row = _require_chapter(db, novel_id, chapter_id)

    field_updates: dict[str, object] = {}
    if payload.user_direction is not None:
        field_updates["user_direction"] = payload.user_direction
    if payload.relevant_entity_ids is not None:
        field_updates["relevant_entity_ids_json"] = json.dumps(payload.relevant_entity_ids)
    if field_updates:
        set_clause = ", ".join(f"{key} = :{key}" for key in field_updates)
        db.execute(
            text(f"UPDATE chapters SET {set_clause} WHERE id = :id"), {**field_updates, "id": chapter_id}
        )
        db.commit()
        chapter_row = _require_chapter(db, novel_id, chapter_id)

    plan = await _generate_plan_content(db, novel_id, chapter_row)
    _save_plan(db, chapter_id, plan)

    row = db.execute(text("SELECT * FROM chapters WHERE id = :id"), {"id": chapter_id}).one()
    return _row_to_chapter(row)


@router.post("", response_model=Chapter)
async def generate_plan(
    novel_id: str, chapter_id: str, payload: PlanGenerateRequest, db: Connection = Depends(get_db)
) -> Chapter:
    return await _generate_and_save(novel_id, chapter_id, payload, db)


@router.post("/regenerate", response_model=Chapter)
async def regenerate_plan(
    novel_id: str, chapter_id: str, payload: PlanGenerateRequest, db: Connection = Depends(get_db)
) -> Chapter:
    return await _generate_and_save(novel_id, chapter_id, payload, db)


@router.put("", response_model=Chapter)
def update_plan(
    novel_id: str, chapter_id: str, payload: PlanUpdateRequest, db: Connection = Depends(get_db)
) -> Chapter:
    _require_chapter(db, novel_id, chapter_id)
    _save_plan(db, chapter_id, payload.plan.model_dump())
    row = db.execute(text("SELECT * FROM chapters WHERE id = :id"), {"id": chapter_id}).one()
    return _row_to_chapter(row)


@router.post("/approve", response_model=Chapter)
def approve_plan(novel_id: str, chapter_id: str, db: Connection = Depends(get_db)) -> Chapter:
    chapter_row = _require_chapter(db, novel_id, chapter_id)
    if not chapter_row.plan_json:
        raise HTTPException(status_code=400, detail="尚未生成章節大綱")
    db.execute(
        text("UPDATE chapters SET plan_approved_at = datetime('now'), updated_at = datetime('now') WHERE id = :id"),
        {"id": chapter_id},
    )
    db.commit()
    row = db.execute(text("SELECT * FROM chapters WHERE id = :id"), {"id": chapter_id}).one()
    return _row_to_chapter(row)
