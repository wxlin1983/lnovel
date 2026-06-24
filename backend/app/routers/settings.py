from fastapi import APIRouter, Depends
from sqlalchemy import Connection, text

from app.deps import get_db
from app.schemas.settings import SettingsOut, SettingsUpdate

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("", response_model=SettingsOut)
def get_settings(db: Connection = Depends(get_db)) -> SettingsOut:
    row = db.execute(
        text("SELECT openrouter_api_key, preferred_model FROM settings WHERE id = 1")
    ).one()
    return SettingsOut(has_key=bool(row.openrouter_api_key), preferred_model=row.preferred_model)


@router.put("", response_model=SettingsOut)
def update_settings(payload: SettingsUpdate, db: Connection = Depends(get_db)) -> SettingsOut:
    updates: dict[str, object] = {}
    if payload.openrouter_api_key is not None:
        updates["openrouter_api_key"] = payload.openrouter_api_key
    if payload.preferred_model is not None:
        updates["preferred_model"] = payload.preferred_model

    if updates:
        set_clause = ", ".join(f"{key} = :{key}" for key in updates)
        db.execute(text(f"UPDATE settings SET {set_clause} WHERE id = 1"), updates)
        db.commit()

    row = db.execute(
        text("SELECT openrouter_api_key, preferred_model FROM settings WHERE id = 1")
    ).one()
    return SettingsOut(has_key=bool(row.openrouter_api_key), preferred_model=row.preferred_model)
