"""Fan speed and LED color/brightness controls."""

from fastapi import APIRouter
from pydantic import BaseModel, Field

from .. import hardware, state

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
