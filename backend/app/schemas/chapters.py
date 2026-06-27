from typing import Any, Literal

from pydantic import BaseModel

ChapterStatus = Literal["planned", "drafted", "final"]


class ChapterCreate(BaseModel):
    chapter_number: int
    title: str = ""
    user_direction: str = ""


class ChapterReorder(BaseModel):
    chapter_ids: list[str]


class ChapterUpdate(BaseModel):
    title: str | None = None
    user_direction: str | None = None
    relevant_entity_ids: list[str] | None = None


class Chapter(BaseModel):
    id: str
    novel_id: str
    chapter_number: int
    title: str
    status: ChapterStatus
    plan: dict[str, Any] | None
    plan_approved_at: str | None
    prose: str
    user_direction: str
    relevant_entity_ids: list[str]
    created_at: str
    updated_at: str
