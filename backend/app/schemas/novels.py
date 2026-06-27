from pydantic import BaseModel

from app.schemas.novel_outline import OutlineChapter


class ChatTurn(BaseModel):
    role: str
    content: str


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
    premise_chat: list[ChatTurn]
    outline_chat: list[ChatTurn]
    rolling_summary: str
    created_at: str
    updated_at: str
