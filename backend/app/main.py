from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.routers import (
    chapter_plan,
    chapter_prose,
    chapters,
    entities,
    entity_chat,
    novels,
    settings as settings_router,
)

app = FastAPI(title="lnovel")

app.include_router(settings_router.router)
app.include_router(novels.router)
app.include_router(entities.router)
app.include_router(entity_chat.router)
app.include_router(chapters.router)
app.include_router(chapter_plan.router)
app.include_router(chapter_prose.router)


@app.get("/api/health")
def health() -> dict[str, bool]:
    return {"ok": True}


if settings.static_dir is not None and settings.static_dir.is_dir():
    app.mount("/", StaticFiles(directory=str(settings.static_dir), html=True), name="static")
