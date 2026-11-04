"""
Light sync: one colour and brightness for every light at once.

"Every light" is the fans' WS2812 LEDs, the closet lights (the Bluetooth
LED strip, if configured)
and each Govee light. They're set in parallel, because the strip may take
several seconds to connect; one light failing doesn't stop the others.

Two modes, like the Govee lights: "color" (an RGB colour) or "white" (a
colour temperature in kelvin). Govee lights have white LEDs and get the
temperature itself; the RGB-only lights (fan LEDs, closet strip) get the closest
RGB colour (kelvin_to_rgb).

The sync settings (on/off, mode, colour, temperature, brightness) are saved
with the rest of the state. Turning sync on applies them straight away.
"""

import math
from concurrent.futures import ThreadPoolExecutor
from typing import Callable, Dict, List, Tuple

from . import govee, hardware, strip
from .settings import LED_STRIP_ADDRESS, SIMULATE_HARDWARE

_sync = {"enabled": False, "mode": "color", "color": {"red": 255, "green": 160, "blue": 60},
         "kelvin": 4000, "brightness": 100}


def kelvin_to_rgb(kelvin: int) -> Tuple[int, int, int]:
    """Approximate RGB for a colour temperature (Tanner Helland's fit of
    blackbody colours), for lights without white LEDs."""
    t = kelvin / 100.0
    if t <= 66:
        red = 255.0
        green = 99.4708025861 * math.log(t) - 161.1195681661
        blue = 0.0 if t <= 19 else 138.5177312231 * math.log(t - 10) - 305.0447927307
    else:
        red = 329.698727446 * (t - 60) ** -0.1332047592
        green = 288.1221695283 * (t - 60) ** -0.0755148492
        blue = 255.0
    return tuple(int(max(0, min(255, round(c)))) for c in (red, green, blue))


def _targets(red: int, green: int, blue: int, brightness: int, kelvin: int = 0) -> List[Tuple[str, Callable[[], None]]]:
    """Every light and how to set it. kelvin > 0 means white mode: Govee
    lights use the temperature, the others the RGB given."""
    def led():
        hardware.set_led_color(red, green, blue)
        hardware.set_led_brightness(brightness)

    def led_strip():
        strip.set_color(red, green, blue)
        strip.set_brightness(brightness)

    targets = [("Fan LEDs", led)]
    if LED_STRIP_ADDRESS or SIMULATE_HARDWARE:
        targets.append(("Closet lights", led_strip))
    for index, light in enumerate(govee.lights()):
        def lamp(index=index):
            if kelvin:
                govee.set_kelvin(index, kelvin)
            else:
                govee.set_color(index, red, green, blue)
            govee.set_brightness(index, brightness)
        targets.append((light["name"], lamp))
    return targets


def _apply() -> List[Dict]:
    if _sync["mode"] == "white":
        red, green, blue = kelvin_to_rgb(_sync["kelvin"])
        targets = _targets(red, green, blue, _sync["brightness"], kelvin=_sync["kelvin"])
    else:
        c = _sync["color"]
        targets = _targets(c["red"], c["green"], c["blue"], _sync["brightness"])

    def run(target):
        name, action = target
        try:
            action()
            return {"name": name, "ok": True}
        except Exception as e:   # each light has its own error type
            return {"name": name, "ok": False, "error": str(e) or type(e).__name__}

    with ThreadPoolExecutor(max_workers=len(targets)) as pool:
        return list(pool.map(run, targets))


def set_sync(enabled: bool, color: Dict[str, int] = None, brightness: int = None,
             mode: str = None, kelvin: int = None) -> Dict:
    """Update the sync settings; while sync is on, apply them to every light."""
    _sync["enabled"] = bool(enabled)
    if mode in ("color", "white"):
        _sync["mode"] = mode
    if kelvin is not None:
        _sync["kelvin"] = max(govee.KELVIN_RANGE[0], min(govee.KELVIN_RANGE[1], int(kelvin)))
    if color is not None:
        _sync["color"] = {k: max(0, min(255, int(color[k]))) for k in ("red", "green", "blue")}
    if brightness is not None:
        _sync["brightness"] = max(1, min(100, int(brightness)))
    results = _apply() if _sync["enabled"] else []
    return {**get_sync(), "results": results}


def get_sync() -> Dict:
    return {
        **saved(),
        "kelvin_range": list(govee.KELVIN_RANGE),
        "lights": [name for name, _ in _targets(0, 0, 0, 100)],
    }


def saved() -> Dict:
    return {"enabled": _sync["enabled"], "mode": _sync["mode"], "color": dict(_sync["color"]),
            "kelvin": _sync["kelvin"], "brightness": _sync["brightness"]}


def restore(saved_sync: Dict) -> None:
    """Load saved settings without applying them (lights keep what they show)."""
    _sync["enabled"] = bool(saved_sync.get("enabled"))
    if saved_sync.get("color"):
        _sync["color"] = {k: int(saved_sync["color"][k]) for k in ("red", "green", "blue")}
    if saved_sync.get("brightness") is not None:
        _sync["brightness"] = int(saved_sync["brightness"])
    if saved_sync.get("mode") in ("color", "white"):
        _sync["mode"] = saved_sync["mode"]
    if saved_sync.get("kelvin"):
        _sync["kelvin"] = int(saved_sync["kelvin"])
