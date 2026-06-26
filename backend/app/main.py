from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException
from starlette.types import Scope

from app.config import settings
from app.routers import (
    chapter_plan,
    chapter_prose,
    chapters,
    entities,
    entity_chat,
    models,
    novel_outline,
    novel_premise,
    novels,
    settings as settings_router,
)

app = FastAPI(title="lnovel")

app.include_router(settings_router.router)
app.include_router(models.router)
app.include_router(novels.router)
app.include_router(novel_premise.router)
app.include_router(novel_outline.router)
app.include_router(entities.router)
app.include_router(entity_chat.router)
app.include_router(chapters.router)
app.include_router(chapter_plan.router)
app.include_router(chapter_prose.router)


@app.get("/api/health")
def health() -> dict[str, bool]:
    return {"ok": True}


class SPAStaticFiles(StaticFiles):
    """Falls back to index.html for unmatched paths, so client-side routes (e.g.
    /novels/:id/outline) work on a hard refresh or direct navigation, not just when
    reached by clicking a Link inside the already-loaded SPA."""

    async def get_response(self, path: str, scope: Scope):
        try:
            return await super().get_response(path, scope)
        except HTTPException as exc:
            if exc.status_code == 404 and not path.startswith("api/"):
                return await super().get_response("index.html", scope)
            raise


if settings.static_dir is not None and settings.static_dir.is_dir():
    app.mount("/", SPAStaticFiles(directory=str(settings.static_dir), html=True), name="static")
