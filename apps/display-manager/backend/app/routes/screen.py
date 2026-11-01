"""Which screen the kiosk shows, the daily schedule, and "Refresh Display"."""

import time

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .. import state
from ..settings import SCREEN_SCHEDULE, TIMEZONE

router = APIRouter(tags=["screen"])

SCREENS = {"clock", "weather", "media"}


class ScreenUpdate(BaseModel):
    screen: str


@router.get("/screen")
def get_screen():
    """The current screen, plus a refresh id the display watches to reload itself."""
    return {**state.current_screen, "refresh": state.display_refresh["id"]}


@router.post("/screen")
def set_screen(data: ScreenUpdate):
    """Switch the kiosk to another screen."""
    if data.screen not in SCREENS:
        raise HTTPException(status_code=422, detail=f"Unknown screen. Use one of: {', '.join(sorted(SCREENS))}")
    state.current_screen["screen"] = data.screen
    state.save()
    return state.current_screen


@router.post("/display/refresh")
def refresh_display():
    """Ask the kiosk page to reload (it checks every few seconds)."""
    state.display_refresh["id"] = int(time.time() * 1000)
    return {"success": True}


@router.get("/schedule")
def get_schedule():
    """The daily automatic screen switches."""
    return {"timezone": str(TIMEZONE), "entries": SCREEN_SCHEDULE}
