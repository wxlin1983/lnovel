from pydantic import BaseModel


class SettingsUpdate(BaseModel):
    openrouter_api_key: str | None = None
    preferred_model: str | None = None


class SettingsOut(BaseModel):
    has_key: bool
    preferred_model: str
