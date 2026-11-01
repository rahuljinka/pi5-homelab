"""
Daily screen switching (for example: clock at 11 PM, weather at noon).

The schedule only acts at those moments, so the screen can still be
changed by hand in between; a manual choice stays until the next switch.
Switching to the clock also puts it on the chosen single photo (the last
one picked with "Use this photo"), even if the slideshow was on during
the day. If no photo has been chosen, the photo mode is left as it is.
Switching away from the clock (to weather at noon) turns the slideshow back
on, so picking the clock by hand during the day shows the slideshow. The
chosen photo is remembered for the next night.
If the Pi is off at a switch time, that switch is skipped, not made up.

Times come from SCREEN_SCHEDULE in .env and use the TZ time zone.
"""

import threading
import time
from datetime import datetime

from . import state
from .routes.clock import list_photos
from .settings import SCREEN_SCHEDULE, TIMEZONE

CHECK_SECONDS = 20


def due_entries(previous: datetime, now: datetime, schedule=None):
    """Scheduled switches whose time fell in (previous, now], oldest first."""
    due = []
    # Look at both dates in case the interval spans midnight.
    for day in sorted({previous.date(), now.date()}):
        for entry in schedule if schedule is not None else SCREEN_SCHEDULE:
            at = datetime.combine(
                day,
                datetime.min.time().replace(hour=entry["hour"], minute=entry["minute"]),
                tzinfo=TIMEZONE,
            )
            if previous < at <= now:
                due.append((at, entry))
    return sorted(due, key=lambda item: item[0])


def use_single_photo():
    """Put the clock on the chosen single photo, if it still exists."""
    chosen = state.clock_photo_mode["file"]
    if chosen and chosen in list_photos():
        state.clock_photo_mode["mode"] = "single"
        return True
    return False


def apply(entry):
    """Make one scheduled switch."""
    state.current_screen["screen"] = entry["screen"]
    if entry["screen"] == "clock":
        use_single_photo()
    else:
        # Night is over: back to the slideshow for any clock use by hand.
        state.clock_photo_mode["mode"] = "slideshow"
    state.save()


def _run():
    previous = datetime.now(TIMEZONE)
    while True:
        time.sleep(CHECK_SECONDS)
        now = datetime.now(TIMEZONE)
        for at, entry in due_entries(previous, now):
            apply(entry)
            print(f"Schedule: switched display to {entry['screen']} at {at:%H:%M}", flush=True)
        previous = now


def start():
    if not SCREEN_SCHEDULE:
        print("Schedule: none set.", flush=True)
        return
    summary = ", ".join(f"{e['screen']} at {e['hour']:02d}:{e['minute']:02d}" for e in SCREEN_SCHEDULE)
    print(f"Schedule running: {summary} ({TIMEZONE})", flush=True)
    threading.Thread(target=_run, daemon=True).start()
