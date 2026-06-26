from pydantic import BaseModel


class OutlineChapter(BaseModel):
    chapter_number: int
    title: str
    summary: str


class OutlineContent(BaseModel):
    chapters: list[OutlineChapter]


class OutlineGenerateRequest(BaseModel):
    chapter_count: int = 10
    user_direction: str | None = None


class OutlineUpdateRequest(BaseModel):
    chapters: list[OutlineChapter]
