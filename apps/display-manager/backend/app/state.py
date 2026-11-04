"""
Runtime state, and saving it so it survives a restart.

Saved to data/state.json: the selected screen, the Media screen's file,
the clock photo mode, the fan and LED settings (which are re-applied
to the hardware on startup) and the Bluetooth LED strip settings (shown
again after a restart, but not re-sent; see strip.py), and the light sync
settings (also not re-sent).

Not saved: what the display reports it is showing, and "show this photo
now" requests. The display re-reports within a few seconds of a restart.
"""

import json
import os
import time

from . import hardware, lights, strip
from .settings import DATA_DIR

STATE_FILE = os.path.join(DATA_DIR, "state.json")

current_screen = {"screen": "clock"}
current_media = {"file": None}

# "slideshow" rotates through the clock photos; "single" stays on `file`.
clock_photo_mode = {"mode": "slideshow", "file": None}

# "Show now" requests from the panel, and the photo the display reports.
clock_photo_state = {"request_file": None, "request_id": 0, "showing": None}

# Bumped by "Refresh Display"; the display reloads when it changes.
display_refresh = {"id": int(time.time())}


def save():
    state = {
        "screen": current_screen["screen"],
        "media": current_media["file"],
        "fan_speed": hardware.get_fan_speed(),
        "led_color": hardware.get_led_color(),
        "led_brightness": hardware.get_led_brightness(),
        "strip": strip.saved(),
        "light_sync": lights.saved(),
        "clock_photo_mode": clock_photo_mode["mode"],
        "clock_photo_file": clock_photo_mode["file"],
    }
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        tmp = STATE_FILE + ".tmp"
        with open(tmp, "w") as f:
            json.dump(state, f)
        os.replace(tmp, STATE_FILE)  # atomic: never leaves a half-written file
    except OSError as e:
        print(f"Could not save state: {e}", flush=True)


def restore():
    try:
        with open(STATE_FILE) as f:
            state = json.load(f)
    except (OSError, ValueError):
        return

    if state.get("screen"):
        # "dashboard" was the clock screen's old name.
        current_screen["screen"] = "clock" if state["screen"] == "dashboard" else state["screen"]
    current_media["file"] = state.get("media")
    if state.get("clock_photo_mode") in ("slideshow", "single"):
        clock_photo_mode["mode"] = state["clock_photo_mode"]
    clock_photo_mode["file"] = state.get("clock_photo_file")

    try:
        if state.get("fan_speed") is not None:
            hardware.set_fan_speed(state["fan_speed"])
    except Exception as e:
        print(f"Could not restore fan speed: {e}", flush=True)

    try:
        color = state.get("led_color")
        if color:
            hardware.set_led_color(color["red"], color["green"], color["blue"])
        if state.get("led_brightness") is not None:
            hardware.set_led_brightness(state["led_brightness"])
    except Exception as e:
        print(f"Could not restore LED: {e}", flush=True)

    try:
        saved_strip = state.get("strip")
        if saved_strip:
            strip.restore(saved_strip["on"], saved_strip["color"], saved_strip["brightness"])
    except Exception as e:
        print(f"Could not restore LED strip settings: {e}", flush=True)

    try:
        if state.get("light_sync"):
            lights.restore(state["light_sync"])
    except Exception as e:
        print(f"Could not restore light sync settings: {e}", flush=True)
