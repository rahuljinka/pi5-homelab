"""Fan speed, LED color/brightness, Bluetooth LED strip, Govee light and light sync controls."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from typing import Literal, Optional

from .. import govee, hardware, lights, state, strip

router = APIRouter(prefix="/hardware", tags=["hardware"])


class FanSpeedUpdate(BaseModel):
    speed: float = Field(ge=0, le=100)


class LEDColorUpdate(BaseModel):
    red: int = Field(ge=0, le=255)
    green: int = Field(ge=0, le=255)
    blue: int = Field(ge=0, le=255)


class BrightnessUpdate(BaseModel):
    brightness: int = Field(ge=0, le=100)


@router.get("")
def get_hardware():
    """Fan and LED wiring details and current settings."""
    return hardware.status()


@router.get("/fan")
def get_fan():
    return hardware.status()["fan"]


@router.post("/fan")
def set_fan(data: FanSpeedUpdate):
    speed = hardware.set_fan_speed(data.speed)
    state.save()
    return {"success": True, "speed_percent": speed}


@router.post("/fan/off")
def fan_off():
    speed = hardware.set_fan_speed(0)
    state.save()
    return {"success": True, "speed_percent": speed}


@router.get("/led")
def get_led():
    return hardware.status()["led"]


@router.post("/led")
def set_led(data: LEDColorUpdate):
    color = hardware.set_led_color(data.red, data.green, data.blue)
    state.save()
    return {"success": True, "color": color, "brightness_percent": hardware.get_led_brightness()}


@router.get("/led/brightness")
def get_led_brightness():
    return {"brightness_percent": hardware.get_led_brightness()}


@router.post("/led/brightness")
def set_led_brightness(data: BrightnessUpdate):
    brightness = hardware.set_led_brightness(data.brightness)
    state.save()
    return {"success": True, "brightness_percent": brightness, "color": hardware.get_led_color()}


@router.post("/led/off")
def led_off():
    hardware.turn_led_off()
    state.save()
    return {"success": True, "color": hardware.get_led_color(), "brightness_percent": hardware.get_led_brightness()}


# ---- Bluetooth LED strip ---------------------------------------------------------

class StripPower(BaseModel):
    on: bool


def _strip_call(action, *args):
    """Run a strip change, save it, and turn bridge failures into a 503."""
    try:
        action(*args)
    except strip.StripError as e:
        raise HTTPException(503, str(e))
    state.save()
    return {"success": True, **strip.saved()}


@router.get("/strip")
def get_strip():
    return strip.status()


@router.post("/strip/power")
def set_strip_power(data: StripPower):
    return _strip_call(strip.set_power, data.on)


@router.post("/strip/color")
def set_strip_color(data: LEDColorUpdate):
    return _strip_call(strip.set_color, data.red, data.green, data.blue)


@router.post("/strip/brightness")
def set_strip_brightness(data: BrightnessUpdate):
    return _strip_call(strip.set_brightness, data.brightness)


# ---- Govee lights -------------------------------------------------------------

class KelvinUpdate(BaseModel):
    kelvin: int = Field(ge=2000, le=9000)


def _govee_call(action, *args):
    try:
        return {"success": True, **action(*args)}
    except govee.GoveeError as e:
        raise HTTPException(503, str(e))


@router.get("/govee")
def get_govee_lights():
    """Every configured Govee light and its current state."""
    return govee.all_status()


@router.get("/govee/{index}")
def get_govee_light(index: int):
    return _govee_call(govee.status, index)


@router.post("/govee/{index}/power")
def set_govee_power(index: int, data: StripPower):
    return _govee_call(govee.set_power, index, data.on)


@router.post("/govee/{index}/brightness")
def set_govee_brightness(index: int, data: BrightnessUpdate):
    return _govee_call(govee.set_brightness, index, data.brightness)


@router.post("/govee/{index}/color")
def set_govee_color(index: int, data: LEDColorUpdate):
    return _govee_call(govee.set_color, index, data.red, data.green, data.blue)


@router.post("/govee/{index}/kelvin")
def set_govee_kelvin(index: int, data: KelvinUpdate):
    return _govee_call(govee.set_kelvin, index, data.kelvin)


# ---- Light sync (every light the same colour) -----------------------------------

class SyncUpdate(BaseModel):
    enabled: bool
    mode: Optional[Literal["color", "white"]] = None
    color: Optional[LEDColorUpdate] = None
    kelvin: Optional[int] = Field(default=None, ge=2000, le=9000)
    brightness: Optional[int] = Field(default=None, ge=1, le=100)


@router.get("/sync")
def get_sync():
    """Sync settings and which lights they apply to."""
    return lights.get_sync()


@router.post("/sync")
def set_sync(data: SyncUpdate):
    """Turn sync on/off and/or change its colour; while on, every light is set.
    Each light's result is reported separately (one failing doesn't stop the rest)."""
    result = lights.set_sync(data.enabled, data.color.model_dump() if data.color else None,
                             data.brightness, data.mode, data.kelvin)
    state.save()
    return result
