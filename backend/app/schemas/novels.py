from pydantic import BaseModel


class NovelCreate(BaseModel):
    title: str
    premise: str = ""


class NovelUpdate(BaseModel):
    title: str | None = None
    premise: str | None = None


class Novel(BaseModel):
    id: str
    title: str
    premise: str
    rolling_summary: str
    created_at: str
    updated_at: str
