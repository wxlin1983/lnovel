from pydantic import BaseModel


class PremiseGenerateRequest(BaseModel):
    inspiration: str | None = None


class PremiseProposal(BaseModel):
    premise: str
