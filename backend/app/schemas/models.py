from pydantic import BaseModel


class FreeModel(BaseModel):
    id: str
    name: str
    context_length: int | None = None
