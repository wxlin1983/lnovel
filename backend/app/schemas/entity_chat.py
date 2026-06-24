from typing import Any, Literal

from pydantic import BaseModel

ChatRole = Literal["user", "assistant", "system"]


class ChatMessageCreate(BaseModel):
    content: str


class ChatMessage(BaseModel):
    id: str
    entity_id: str
    role: ChatRole
    content: str
    proposed_patch: dict[str, Any] | None
    applied: bool
    created_at: str
