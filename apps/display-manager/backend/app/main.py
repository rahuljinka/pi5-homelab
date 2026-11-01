"""
Display manager backend (FastAPI).

Serves the API behind the control panel and the kiosk display. Every
endpoint lives under /api; interactive API docs are at /api/docs once
logged in to the panel. See auth.py for who may call what.

Run: uvicorn app.main:app --host 0.0.0.0 --port 8000
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from pydantic import BaseModel

from . import auth, schedule, state
from .routes import clock, hardware, media, screen, system, weather
from .settings import APP_ENV


@asynccontextmanager
async def lifespan(_app: FastAPI):
    auth.init()        # prints the one-time setup code if no password exists
    state.restore()    # saved screen, media, clock mode; re-applies fan and LED
    schedule.start()   # daily screen switching
    yield


app = FastAPI(
    title="Pi Display Manager API",
    description="Controls the Raspberry Pi kiosk display, its fan and LED, and its media.",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url=None,
)

app.middleware("http")(auth.guard)


class LoginBody(BaseModel):
    password: str


class SetupBody(BaseModel):
    code: str
    password: str


@app.get("/api/health", tags=["auth"])
def health():
    return {"ok": True, "env": APP_ENV}


@app.get("/api/auth/status", tags=["auth"])
def auth_status(request: Request):
    """Whether this browser is logged in, and whether first-time setup is needed."""
    return auth.status(request)


@app.post("/api/auth/setup", tags=["auth"])
def auth_setup(body: SetupBody):
    """Create the panel password using the one-time code from the backend log."""
    return auth.setup(body.code, body.password)


@app.post("/api/auth/login", tags=["auth"])
def auth_login(body: LoginBody):
    return auth.login(body.password)


@app.post("/api/auth/logout", tags=["auth"])
def auth_logout(request: Request):
    return auth.logout(request)


for module in (screen, system, hardware, media, clock, weather):
    app.include_router(module.router, prefix="/api")
