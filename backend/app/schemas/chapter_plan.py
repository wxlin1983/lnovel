from pydantic import BaseModel


class PlanBeat(BaseModel):
    title: str
    summary: str


class ChapterPlanContent(BaseModel):
    beats: list[PlanBeat]


class PlanGenerateRequest(BaseModel):
    user_direction: str | None = None
    relevant_entity_ids: list[str] | None = None


class PlanUpdateRequest(BaseModel):
    plan: ChapterPlanContent
