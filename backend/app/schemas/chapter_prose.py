from pydantic import BaseModel


class ProseGenerateRequest(BaseModel):
    user_direction: str | None = None


class ProseUpdateRequest(BaseModel):
    prose: str


class ChapterRevision(BaseModel):
    id: str
    chapter_id: str
    content: str
    created_at: str
