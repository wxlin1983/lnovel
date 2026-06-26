from pydantic import BaseModel

from app.schemas.novel_outline import OutlineChapter


class NovelCreate(BaseModel):
    title: str
    premise: str = ""
    inspiration: str = ""


class NovelUpdate(BaseModel):
    title: str | None = None
    premise: str | None = None
    inspiration: str | None = None


class Novel(BaseModel):
    id: str
    title: str
    premise: str
    inspiration: str
    book_outline: list[OutlineChapter]
    rolling_summary: str
    created_at: str
    updated_at: str
