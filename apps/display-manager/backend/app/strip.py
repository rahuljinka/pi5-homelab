"""
Bluetooth LED strip.

The strip's controller is reached through the ble-bridge service (see
ble-bridge/bridge.py), which owns the Bluetooth connection. This module
keeps the chosen settings and forwards changes to the bridge.

The controller remembers its own state, so saved settings are only shown
after a restart, not re-sent: a reboot of the Pi never switches the strip
on by itself. With SIMULATE_HARDWARE set (dev), nothing is sent.
"""

from typing import Dict

import requests

from .settings import LED_STRIP_ADDRESS, LED_STRIP_BRIDGE_URL, SIMULATE_HARDWARE

TIMEOUT_SECONDS = 40   # the bridge may scan and connect first (up to ~25 s)

_on = False
_color = (255, 255, 255)
_brightness = 100


class StripError(Exception):
    pass


def _post(path: str, body: Dict) -> None:
    if SIMULATE_HARDWARE:
        return
    try:
        response = requests.post(f"{LED_STRIP_BRIDGE_URL}{path}", json=body, timeout=TIMEOUT_SECONDS)
    except requests.RequestException as e:
        raise StripError(f"Bluetooth bridge unreachable: {e}") from e
    if not response.ok:
        try:
            detail = response.json().get("detail")
        except ValueError:
            detail = None
        raise StripError(detail or f"Bluetooth bridge error (HTTP {response.status_code})")


def set_power(on: bool) -> None:
    global _on
    _post("/power", {"on": on})
    _on = on


def set_color(red: int, green: int, blue: int) -> None:
    global _color, _on
    color = tuple(max(0, min(255, int(c))) for c in (red, green, blue))
    if not _on:
        _post("/power", {"on": True})   # changing the colour switches the strip on
        _on = True
    _post("/color", dict(zip(("red", "green", "blue"), color)))
    _color = color


def set_brightness(percent: int) -> None:
    global _brightness, _on
    percent = max(0, min(100, int(percent)))
    if not _on:
        _post("/power", {"on": True})
        _on = True
    _post("/brightness", {"brightness": percent})
    _brightness = percent


def restore(on: bool, color: Dict[str, int], brightness: int) -> None:
    """Load saved settings without sending them (see the module docstring)."""
    global _on, _color, _brightness
    _on = bool(on)
    _color = (int(color["red"]), int(color["green"]), int(color["blue"]))
    _brightness = int(brightness)


def get_color() -> Dict[str, int]:
    r, g, b = _color
    return {"red": r, "green": g, "blue": b}


def saved() -> Dict:
    return {"on": _on, "color": get_color(), "brightness": _brightness}


def status() -> Dict:
    connected = None
    if SIMULATE_HARDWARE:
        configured = True
    else:
        configured = bool(LED_STRIP_ADDRESS)
        try:
            bridge = requests.get(f"{LED_STRIP_BRIDGE_URL}/status", timeout=3).json()
            configured = bridge.get("configured", configured)
            connected = bridge.get("connected")
        except (requests.RequestException, ValueError):
            pass
    return {
        "available": configured,
        "simulated": SIMULATE_HARDWARE,
        "type": "Bluetooth LED strip",
        "connected": connected,
        **saved(),
    }
