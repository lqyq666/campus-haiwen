"""Campus Advisor, narrowed to guided admission assessment only."""
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from .assessment_store import init_store
from .privacy import install_sensitive_logging_filter
from .routes import router

ROOT = Path(__file__).resolve().parent.parent
app = FastAPI(title="升学智能测评")
init_store()
install_sensitive_logging_filter()
app.include_router(router)
app.mount("/static", StaticFiles(directory=str(ROOT / "static")), name="static")


@app.get("/", include_in_schema=False)
def home():
    return RedirectResponse("/qna.html")


@app.get("/qna.html", include_in_schema=False)
def assessment_page():
    return FileResponse(
        ROOT / "qna.html",
        headers={"Cache-Control": "no-cache, no-store, must-revalidate"},
    )
