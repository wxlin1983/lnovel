import json
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import Connection, text
from sqlalchemy.exc import IntegrityError

from app.deps import get_db
from app.schemas.chapters import Chapter, ChapterCreate, ChapterReorder, ChapterUpdate

router = APIRouter(prefix="/api/novels/{novel_id}/chapters", tags=["chapters"])


def _row_to_chapter(row) -> Chapter:
    return Chapter(
        id=row.id,
        novel_id=row.novel_id,
        chapter_number=row.chapter_number,
        title=row.title,
        status=row.status,
        plan=json.loads(row.plan_json) if row.plan_json else None,
        plan_approved_at=row.plan_approved_at,
        prose=row.prose,
        user_direction=row.user_direction,
        relevant_entity_ids=json.loads(row.relevant_entity_ids_json),
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _require_novel(db: Connection, novel_id: str) -> None:
    row = db.execute(text("SELECT id FROM novels WHERE id = :id"), {"id": novel_id}).one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Novel not found")


def _require_chapter(db: Connection, novel_id: str, chapter_id: str):
    row = db.execute(
        text("SELECT * FROM chapters WHERE id = :id AND novel_id = :novel_id"),
        {"id": chapter_id, "novel_id": novel_id},
    ).one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Chapter not found")
    return row


@router.get("", response_model=list[Chapter])
def list_chapters(novel_id: str, db: Connection = Depends(get_db)) -> list[Chapter]:
    _require_novel(db, novel_id)
    rows = db.execute(
        text("SELECT * FROM chapters WHERE novel_id = :novel_id ORDER BY chapter_number ASC"),
        {"novel_id": novel_id},
    ).all()
    return [_row_to_chapter(row) for row in rows]


@router.post("", response_model=Chapter, status_code=201)
def create_chapter(novel_id: str, payload: ChapterCreate, db: Connection = Depends(get_db)) -> Chapter:
    _require_novel(db, novel_id)
    chapter_id = uuid.uuid4().hex
    try:
        db.execute(
            text(
                "INSERT INTO chapters (id, novel_id, chapter_number, title, user_direction) "
                "VALUES (:id, :novel_id, :chapter_number, :title, :user_direction)"
            ),
            {
                "id": chapter_id,
                "novel_id": novel_id,
                "chapter_number": payload.chapter_number,
                "title": payload.title,
                "user_direction": payload.user_direction,
            },
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Chapter number already exists") from exc
    row = db.execute(text("SELECT * FROM chapters WHERE id = :id"), {"id": chapter_id}).one()
    return _row_to_chapter(row)


@router.get("/{chapter_id}", response_model=Chapter)
def get_chapter(novel_id: str, chapter_id: str, db: Connection = Depends(get_db)) -> Chapter:
    row = _require_chapter(db, novel_id, chapter_id)
    return _row_to_chapter(row)


@router.put("/{chapter_id}", response_model=Chapter)
def update_chapter(
    novel_id: str, chapter_id: str, payload: ChapterUpdate, db: Connection = Depends(get_db)
) -> Chapter:
    _require_chapter(db, novel_id, chapter_id)

    updates: dict[str, object] = {}
    if payload.title is not None:
        updates["title"] = payload.title
    if payload.user_direction is not None:
        updates["user_direction"] = payload.user_direction
    if payload.relevant_entity_ids is not None:
        updates["relevant_entity_ids_json"] = json.dumps(payload.relevant_entity_ids)

    if updates:
        set_clause = ", ".join(f"{key} = :{key}" for key in updates) + ", updated_at = datetime('now')"
        db.execute(text(f"UPDATE chapters SET {set_clause} WHERE id = :id"), {**updates, "id": chapter_id})
        db.commit()

    row = db.execute(text("SELECT * FROM chapters WHERE id = :id"), {"id": chapter_id}).one()
    return _row_to_chapter(row)


@router.delete("/{chapter_id}", status_code=204)
def delete_chapter(novel_id: str, chapter_id: str, db: Connection = Depends(get_db)) -> None:
    _require_chapter(db, novel_id, chapter_id)
    db.execute(text("DELETE FROM chapters WHERE id = :id"), {"id": chapter_id})
    # Renumber remaining chapters to close the gap, using two passes to avoid
    # the UNIQUE(novel_id, chapter_number) constraint firing mid-update.
    remaining = db.execute(
        text("SELECT id FROM chapters WHERE novel_id = :novel_id ORDER BY chapter_number ASC"),
        {"novel_id": novel_id},
    ).all()
    for i, row in enumerate(remaining):
        db.execute(text("UPDATE chapters SET chapter_number = :n WHERE id = :id"), {"n": -(i + 1), "id": row.id})
    for i, row in enumerate(remaining):
        db.execute(text("UPDATE chapters SET chapter_number = :n WHERE id = :id"), {"n": i + 1, "id": row.id})
    db.commit()


@router.post("/reorder", status_code=204)
def reorder_chapters(novel_id: str, payload: ChapterReorder, db: Connection = Depends(get_db)) -> None:
    _require_novel(db, novel_id)
    # Validate all IDs belong to this novel
    rows = db.execute(
        text("SELECT id FROM chapters WHERE novel_id = :novel_id"),
        {"novel_id": novel_id},
    ).all()
    existing_ids = {row.id for row in rows}
    if set(payload.chapter_ids) != existing_ids:
        raise HTTPException(status_code=400, detail="chapter_ids must contain exactly all chapters for this novel")

    # Two-pass to avoid UNIQUE(novel_id, chapter_number) conflicts mid-transaction:
    # first shift all to large negative temps, then assign final 1..N values.
    for i, chapter_id in enumerate(payload.chapter_ids):
        db.execute(
            text("UPDATE chapters SET chapter_number = :n WHERE id = :id"),
            {"n": -(i + 1), "id": chapter_id},
        )
    for i, chapter_id in enumerate(payload.chapter_ids):
        db.execute(
            text("UPDATE chapters SET chapter_number = :n WHERE id = :id"),
            {"n": i + 1, "id": chapter_id},
        )
    db.commit()
