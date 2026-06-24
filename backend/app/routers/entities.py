import json
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import Connection, text

from app.deps import get_db
from app.schemas.entities import Entity, EntityCreate, EntityUpdate

router = APIRouter(prefix="/api/novels/{novel_id}/entities", tags=["entities"])


def _row_to_entity(row) -> Entity:
    return Entity(
        id=row.id,
        novel_id=row.novel_id,
        type=row.type,
        name=row.name,
        fields=json.loads(row.fields_json),
        description=row.description,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _require_novel(db: Connection, novel_id: str) -> None:
    row = db.execute(text("SELECT id FROM novels WHERE id = :id"), {"id": novel_id}).one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Novel not found")


@router.get("", response_model=list[Entity])
def list_entities(
    novel_id: str, type: str | None = None, db: Connection = Depends(get_db)
) -> list[Entity]:
    _require_novel(db, novel_id)
    query = "SELECT * FROM entities WHERE novel_id = :novel_id"
    params: dict[str, object] = {"novel_id": novel_id}
    if type is not None:
        query += " AND type = :type"
        params["type"] = type
    query += " ORDER BY created_at DESC"
    rows = db.execute(text(query), params).all()
    return [_row_to_entity(row) for row in rows]


@router.post("", response_model=Entity, status_code=201)
def create_entity(novel_id: str, payload: EntityCreate, db: Connection = Depends(get_db)) -> Entity:
    _require_novel(db, novel_id)
    entity_id = uuid.uuid4().hex
    db.execute(
        text(
            "INSERT INTO entities (id, novel_id, type, name, fields_json, description) "
            "VALUES (:id, :novel_id, :type, :name, :fields_json, :description)"
        ),
        {
            "id": entity_id,
            "novel_id": novel_id,
            "type": payload.type,
            "name": payload.name,
            "fields_json": json.dumps(payload.fields),
            "description": payload.description,
        },
    )
    db.commit()
    row = db.execute(text("SELECT * FROM entities WHERE id = :id"), {"id": entity_id}).one()
    return _row_to_entity(row)


@router.get("/{entity_id}", response_model=Entity)
def get_entity(novel_id: str, entity_id: str, db: Connection = Depends(get_db)) -> Entity:
    row = db.execute(
        text("SELECT * FROM entities WHERE id = :id AND novel_id = :novel_id"),
        {"id": entity_id, "novel_id": novel_id},
    ).one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Entity not found")
    return _row_to_entity(row)


@router.put("/{entity_id}", response_model=Entity)
def update_entity(
    novel_id: str, entity_id: str, payload: EntityUpdate, db: Connection = Depends(get_db)
) -> Entity:
    row = db.execute(
        text("SELECT * FROM entities WHERE id = :id AND novel_id = :novel_id"),
        {"id": entity_id, "novel_id": novel_id},
    ).one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Entity not found")

    updates: dict[str, object] = {}
    if payload.name is not None:
        updates["name"] = payload.name
    if payload.fields is not None:
        updates["fields_json"] = json.dumps(payload.fields)
    if payload.description is not None:
        updates["description"] = payload.description

    if updates:
        set_clause = ", ".join(f"{key} = :{key}" for key in updates) + ", updated_at = datetime('now')"
        db.execute(text(f"UPDATE entities SET {set_clause} WHERE id = :id"), {**updates, "id": entity_id})
        db.commit()

    row = db.execute(text("SELECT * FROM entities WHERE id = :id"), {"id": entity_id}).one()
    return _row_to_entity(row)


@router.delete("/{entity_id}", status_code=204)
def delete_entity(novel_id: str, entity_id: str, db: Connection = Depends(get_db)) -> None:
    row = db.execute(
        text("SELECT id FROM entities WHERE id = :id AND novel_id = :novel_id"),
        {"id": entity_id, "novel_id": novel_id},
    ).one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Entity not found")
    db.execute(text("DELETE FROM entities WHERE id = :id"), {"id": entity_id})
    db.commit()
