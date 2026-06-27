from pydantic import BaseModel


class PremiseGenerateRequest(BaseModel):
    inspiration: str | None = None


class PremiseReviseRequest(BaseModel):
    message: str


class PremiseProposal(BaseModel):
    premise: str
