import json
import re
import uuid
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import Connection, text
from sse_starlette import EventSourceResponse

from app.deps import get_db
from app.llm.openrouter_client import OpenRouterError, stream_chat_completion
from app.llm.prompts.entity_improve import build_messages
from app.routers.entities import _row_to_entity
from app.schemas.entities import Entity
from app.schemas.entity_chat import ChatMessage, ChatMessageCreate

router = APIRouter(prefix="/api/novels/{novel_id}/entities/{entity_id}/chat", tags=["entity_chat"])

PATCH_BLOCK_RE = re.compile(r"```patch\s*\n(.*?)\n```", re.DOTALL)


def _row_to_message(row) -> ChatMessage:
    return ChatMessage(
        id=row.id,
        entity_id=row.entity_id,
        role=row.role,
        content=row.content,
        proposed_patch=json.loads(row.proposed_patch_json) if row.proposed_patch_json else None,
        applied=bool(row.applied),
        created_at=row.created_at,
    )


def _require_entity(db: Connection, novel_id: str, entity_id: str):
    row = db.execute(
        text("SELECT * FROM entities WHERE id = :id AND novel_id = :novel_id"),
        {"id": entity_id, "novel_id": novel_id},
    ).one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Entity not found")
    return row


def _extract_patch(full_text: str) -> tuple[str, dict[str, Any] | None]:
    match = PATCH_BLOCK_RE.search(full_text)
    if not match:
        return full_text.strip(), None
    try:
        patch = json.loads(match.group(1))
    except json.JSONDecodeError:
        return full_text.strip(), None
    content = PATCH_BLOCK_RE.sub("", full_text).strip()
    return content, patch


@router.get("", response_model=list[ChatMessage])
def list_messages(novel_id: str, entity_id: str, db: Connection = Depends(get_db)) -> list[ChatMessage]:
    _require_entity(db, novel_id, entity_id)
    rows = db.execute(
        text("SELECT * FROM entity_chat_messages WHERE entity_id = :entity_id ORDER BY created_at ASC"),
        {"entity_id": entity_id},
    ).all()
    return [_row_to_message(row) for row in rows]


@router.post("")
def send_message(
    novel_id: str, entity_id: str, payload: ChatMessageCreate, db: Connection = Depends(get_db)
) -> EventSourceResponse:
    entity_row = _require_entity(db, novel_id, entity_id)
    novel_row = db.execute(text("SELECT * FROM novels WHERE id = :id"), {"id": novel_id}).one()

    settings_row = db.execute(
        text("SELECT openrouter_api_key, preferred_model FROM settings WHERE id = 1")
    ).one()
    if not settings_row.openrouter_api_key:
        raise HTTPException(status_code=400, detail="尚未設定 OpenRouter API 金鑰")

    history_rows = db.execute(
        text(
            "SELECT role, content FROM entity_chat_messages "
            "WHERE entity_id = :entity_id ORDER BY created_at ASC"
        ),
        {"entity_id": entity_id},
    ).all()
    history = [{"role": r.role, "content": r.content} for r in history_rows]

    user_message_id = uuid.uuid4().hex
    db.execute(
        text(
            "INSERT INTO entity_chat_messages (id, entity_id, role, content) "
            "VALUES (:id, :entity_id, 'user', :content)"
        ),
        {"id": user_message_id, "entity_id": entity_id, "content": payload.content},
    )
    db.commit()

    messages = build_messages(
        novel_premise=novel_row.premise,
        entity_type=entity_row.type,
        entity_name=entity_row.name,
        entity_description=entity_row.description,
        entity_fields=json.loads(entity_row.fields_json),
        linked_summaries=[],
        history=[*history, {"role": "user", "content": payload.content}],
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

        content, patch = _extract_patch(accumulated)
        assistant_id = uuid.uuid4().hex
        db.execute(
            text(
                "INSERT INTO entity_chat_messages (id, entity_id, role, content, proposed_patch_json) "
                "VALUES (:id, :entity_id, 'assistant', :content, :patch)"
            ),
            {
                "id": assistant_id,
                "entity_id": entity_id,
                "content": content,
                "patch": json.dumps(patch, ensure_ascii=False) if patch else None,
            },
        )
        db.commit()
        yield {
            "event": "done",
            "data": json.dumps(
                {"message_id": assistant_id, "content": content, "proposed_patch": patch},
                ensure_ascii=False,
            ),
        }

    return EventSourceResponse(event_generator())


@router.post("/{message_id}/apply-patch", response_model=Entity)
def apply_patch(
    novel_id: str, entity_id: str, message_id: str, db: Connection = Depends(get_db)
) -> Entity:
    entity_row = _require_entity(db, novel_id, entity_id)
    message_row = db.execute(
        text("SELECT * FROM entity_chat_messages WHERE id = :id AND entity_id = :entity_id"),
        {"id": message_id, "entity_id": entity_id},
    ).one_or_none()
    if message_row is None:
        raise HTTPException(status_code=404, detail="Chat message not found")
    if not message_row.proposed_patch_json:
        raise HTTPException(status_code=400, detail="This message has no proposed patch")
    if message_row.applied:
        raise HTTPException(status_code=400, detail="Patch already applied")

    patch = json.loads(message_row.proposed_patch_json)
    fields = json.loads(entity_row.fields_json)
    if "fields" in patch and isinstance(patch["fields"], dict):
        fields.update(patch["fields"])
    description = patch.get("description", entity_row.description)

    db.execute(
        text(
            "UPDATE entities SET fields_json = :fields_json, description = :description, "
            "updated_at = datetime('now') WHERE id = :id"
        ),
        {"fields_json": json.dumps(fields, ensure_ascii=False), "description": description, "id": entity_id},
    )
    db.execute(
        text("UPDATE entity_chat_messages SET applied = 1 WHERE id = :id"), {"id": message_id}
    )
    db.commit()

    row = db.execute(text("SELECT * FROM entities WHERE id = :id"), {"id": entity_id}).one()
    return _row_to_entity(row)
