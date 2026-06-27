import logging
import time
import traceback

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException
from starlette.types import Scope

from app.config import settings
from app.logging_config import setup_logging
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

setup_logging(settings.data_dir)
logger = logging.getLogger(__name__)

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


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.monotonic()
    response = await call_next(request)
    ms = (time.monotonic() - start) * 1000
    level = logging.WARNING if response.status_code >= 400 else logging.DEBUG
    logger.log(level, "%s %s → %d  (%.0fms)", request.method, request.url.path, response.status_code, ms)
    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error(
        "Unhandled exception on %s %s\n%s",
        request.method,
        request.url.path,
        traceback.format_exc(),
    )
    return JSONResponse(status_code=500, content={"detail": str(exc)})


@app.get("/api/health")
def health() -> dict[str, bool]:
    return {"ok": True}


@app.get("/api/logs")
def get_logs(lines: int = 100) -> dict:
    """Return the last N lines of lnovel.log for in-browser debugging."""
    log_file = settings.data_dir / "lnovel.log"
    if not log_file.exists():
        return {"lines": []}
    text = log_file.read_text(encoding="utf-8", errors="replace")
    return {"lines": text.splitlines()[-lines:]}


class SPAStaticFiles(StaticFiles):
    """Falls back to index.html for unmatched paths so client-side routes work on hard refresh."""

    async def get_response(self, path: str, scope: Scope):
        try:
            return await super().get_response(path, scope)
        except HTTPException as exc:
            if exc.status_code == 404 and not path.startswith("api/"):
                return await super().get_response("index.html", scope)
            raise


if settings.static_dir is not None and settings.static_dir.is_dir():
    app.mount("/", SPAStaticFiles(directory=str(settings.static_dir), html=True), name="static")
