from typing import Literal

from pydantic import BaseModel

Provider = Literal["openrouter", "ollama"]


class SettingsUpdate(BaseModel):
    provider: Provider | None = None
    openrouter_api_key: str | None = None
    preferred_model: str | None = None
    ollama_base_url: str | None = None


class SettingsOut(BaseModel):
    provider: Provider
    has_key: bool
    preferred_model: str
    ollama_base_url: str
