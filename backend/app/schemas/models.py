from pydantic import BaseModel


class ModelOption(BaseModel):
    id: str
    name: str
    context_length: int | None = None
