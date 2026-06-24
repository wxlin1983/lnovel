from fastapi import APIRouter, Depends
from sqlalchemy import Connection, text

from app.deps import get_db
from app.schemas.settings import SettingsOut, SettingsUpdate

router = APIRouter(prefix="/api/settings", tags=["settings"])

SETTINGS_COLUMNS = "provider, openrouter_api_key, preferred_model, ollama_base_url"


def _row_to_out(row) -> SettingsOut:
    return SettingsOut(
        provider=row.provider,
        has_key=bool(row.openrouter_api_key),
        preferred_model=row.preferred_model,
        ollama_base_url=row.ollama_base_url,
    )


@router.get("", response_model=SettingsOut)
def get_settings(db: Connection = Depends(get_db)) -> SettingsOut:
    row = db.execute(text(f"SELECT {SETTINGS_COLUMNS} FROM settings WHERE id = 1")).one()
    return _row_to_out(row)


@router.put("", response_model=SettingsOut)
def update_settings(payload: SettingsUpdate, db: Connection = Depends(get_db)) -> SettingsOut:
    updates: dict[str, object] = {}
    if payload.provider is not None:
        updates["provider"] = payload.provider
    if payload.openrouter_api_key is not None:
        updates["openrouter_api_key"] = payload.openrouter_api_key
    if payload.preferred_model is not None:
        updates["preferred_model"] = payload.preferred_model
    if payload.ollama_base_url is not None:
        updates["ollama_base_url"] = payload.ollama_base_url

    if updates:
        set_clause = ", ".join(f"{key} = :{key}" for key in updates)
        db.execute(text(f"UPDATE settings SET {set_clause} WHERE id = 1"), updates)
        db.commit()

    row = db.execute(text(f"SELECT {SETTINGS_COLUMNS} FROM settings WHERE id = 1")).one()
    return _row_to_out(row)
