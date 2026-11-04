"""
Settings for the display manager backend.

Everything personal or machine-specific (location, addresses, schedule)
comes from environment variables, which Docker Compose fills from the
app's local `.env` file. `.env.example` lists every variable with fake
values; the real `.env` is never committed.
"""

import os
from zoneinfo import ZoneInfo


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def _flag(name: str) -> bool:
    return _env(name).lower() in ("1", "true", "yes", "on")


# ---- Environment ------------------------------------------------------------

# "prod" on the Pi; "dev" for the development stack (compose.dev.yaml).
APP_ENV = _env("APP_ENV", "prod")

# Dev only: skip the panel login, and pretend the fan/LED/reboot exist
# without touching real hardware.
AUTH_DISABLED = _flag("AUTH_DISABLED")
SIMULATE_HARDWARE = _flag("SIMULATE_HARDWARE")

# ---- Paths inside the container -------------------------------------------

DATA_DIR = "/app/data"                    # saved settings, sessions, photo cache
MEDIA_DIR = "/app/media"                  # Media Library uploads (GIFs, images)
CLOCK_PHOTO_DIR = "/app/clock-photos"     # Clock screen wallpapers
HOST_REQUEST_DIR = DATA_DIR + "/host-requests"  # reboot/poweroff requests for the host helper

# ---- About the Pi (shown in the control panel) ------------------------------

# Address shown in System Information. The container can't see the Pi's
# own network address, so it's set in .env.
PI_ADDRESS = _env("PI_ADDRESS", "—")

# Drives shown in System Information, as "Label=path;Label=path".
# Each path is a small bind-mounted folder on that drive; the first one is
# the system drive. See compose.yaml for how the folders are mounted.
DRIVES = [
    {"name": label.strip(), "path": path.strip()}
    for label, _, path in (
        item.partition("=")
        for item in _env("DRIVES", "System drive=/drives/system").split(";")
        if "=" in item
    )
]

# ---- Time, schedule and weather -------------------------------------------

TIMEZONE = ZoneInfo(_env("TZ", "UTC"))

# Daily screen switches as "HH:MM=screen,HH:MM=screen". Empty disables.
SCREEN_SCHEDULE = [
    {"hour": int(t.split(":")[0]), "minute": int(t.split(":")[1]), "screen": screen.strip()}
    for t, _, screen in (
        item.strip().partition("=")
        for item in _env("SCREEN_SCHEDULE", "").split(",")
        if "=" in item
    )
]

WEATHER_LATITUDE = _env("WEATHER_LATITUDE")
WEATHER_LONGITUDE = _env("WEATHER_LONGITUDE")
WEATHER_LOCATION_NAME = _env("WEATHER_LOCATION_NAME", "Weather")
WEATHER_UNITS = _env("WEATHER_UNITS", "fahrenheit")  # or "celsius"
WEATHER_CACHE_SECONDS = 600

# ---- Bluetooth LED strip -----------------------------------------------------

# The strip controller's Bluetooth address. Empty means no strip.
LED_STRIP_ADDRESS = _env("LED_STRIP_ADDRESS")
# The ble-bridge service on the internal Docker network.
LED_STRIP_BRIDGE_URL = _env("LED_STRIP_BRIDGE_URL", "http://ble-bridge:8100")

# ---- Govee lights (LAN API) ----------------------------------------------------

# "Name=ip;Name=ip". Empty means none. See govee.py.
GOVEE_LIGHTS = [
    {"name": name.strip(), "ip": ip.strip()}
    for name, _, ip in (
        item.partition("=")
        for item in _env("GOVEE_LIGHTS").split(";")
        if "=" in item
    )
]

# ---- Access -------------------------------------------------------------------

# Shared secret the display's web server adds to every request it forwards.
# Requests carrying it may only use the read-only endpoints the display needs.
DISPLAY_KEY = _env("DISPLAY_KEY")

# How long a control panel login lasts.
SESSION_DAYS = 30
