from typing import Any, Literal

from pydantic import BaseModel

EntityType = Literal["character", "location", "storyline"]


class EntityCreate(BaseModel):
    type: EntityType
    name: str
    fields: dict[str, Any] = {}
    description: str = ""


class EntityUpdate(BaseModel):
    name: str | None = None
    fields: dict[str, Any] | None = None
    description: str | None = None


class Entity(BaseModel):
    id: str
    novel_id: str
    type: EntityType
    name: str
    fields: dict[str, Any]
    description: str
    created_at: str
    updated_at: str
