import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import Connection, text

from app.deps import get_db
from app.schemas.novels import Novel, NovelCreate, NovelUpdate

router = APIRouter(prefix="/api/novels", tags=["novels"])


def _row_to_novel(row) -> Novel:
    return Novel(
        id=row.id,
        title=row.title,
        premise=row.premise,
        rolling_summary=row.rolling_summary,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.get("", response_model=list[Novel])
def list_novels(db: Connection = Depends(get_db)) -> list[Novel]:
    rows = db.execute(text("SELECT * FROM novels ORDER BY created_at DESC")).all()
    return [_row_to_novel(row) for row in rows]


@router.post("", response_model=Novel, status_code=201)
def create_novel(payload: NovelCreate, db: Connection = Depends(get_db)) -> Novel:
    novel_id = uuid.uuid4().hex
    db.execute(
        text("INSERT INTO novels (id, title, premise) VALUES (:id, :title, :premise)"),
        {"id": novel_id, "title": payload.title, "premise": payload.premise},
    )
    db.commit()
    row = db.execute(text("SELECT * FROM novels WHERE id = :id"), {"id": novel_id}).one()
    return _row_to_novel(row)


@router.get("/{novel_id}", response_model=Novel)
def get_novel(novel_id: str, db: Connection = Depends(get_db)) -> Novel:
    row = db.execute(text("SELECT * FROM novels WHERE id = :id"), {"id": novel_id}).one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Novel not found")
    return _row_to_novel(row)


@router.put("/{novel_id}", response_model=Novel)
def update_novel(novel_id: str, payload: NovelUpdate, db: Connection = Depends(get_db)) -> Novel:
    existing = db.execute(text("SELECT id FROM novels WHERE id = :id"), {"id": novel_id}).one_or_none()
    if existing is None:
        raise HTTPException(status_code=404, detail="Novel not found")

    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if updates:
        set_clause = ", ".join(f"{key} = :{key}" for key in updates) + ", updated_at = datetime('now')"
        db.execute(text(f"UPDATE novels SET {set_clause} WHERE id = :id"), {**updates, "id": novel_id})
        db.commit()

    row = db.execute(text("SELECT * FROM novels WHERE id = :id"), {"id": novel_id}).one()
    return _row_to_novel(row)


@router.delete("/{novel_id}", status_code=204)
def delete_novel(novel_id: str, db: Connection = Depends(get_db)) -> None:
    existing = db.execute(text("SELECT id FROM novels WHERE id = :id"), {"id": novel_id}).one_or_none()
    if existing is None:
        raise HTTPException(status_code=404, detail="Novel not found")
    db.execute(text("DELETE FROM novels WHERE id = :id"), {"id": novel_id})
    db.commit()
