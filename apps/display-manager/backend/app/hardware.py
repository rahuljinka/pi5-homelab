"""
Fan and LED control.

Two 4010 RGB PWM fans, each with a WS2812 LED built in. Their PWM wires
are joined with a 2-to-1 cable, and so are their LED data wires, so the Pi
drives them as one fan and one LED: same speed, same colour.

Fan:  PWM on GPIO 18 (physical pin 12), Linux PWM chip 0 channel 2,
      driven at 25 kHz through the kernel's /sys/class/pwm files.
LED:  WS2812 data on GPIO 10 (physical pin 19), driven over SPI0.0.

Both need the matching lines in /boot/firmware/config.txt (see
host/boot/config.txt). The container gets /sys and /dev/spidev0.0 only,
not full privileges.

Brightness is applied when the LED is written, so the chosen color is kept
when brightness changes. With SIMULATE_HARDWARE set (dev), every call
updates the values but nothing touches real hardware.
"""

import os
from typing import Dict

from .settings import SIMULATE_HARDWARE

PWM_CHIP = "/sys/class/pwm/pwmchip0"
PWM_CHANNEL = 2
PWM_PATH = f"{PWM_CHIP}/pwm{PWM_CHANNEL}"
FAN_GPIO = 18
FAN_PHYSICAL_PIN = 12
FAN_FREQUENCY_HZ = 25_000
PWM_PERIOD_NS = 1_000_000_000 // FAN_FREQUENCY_HZ  # 40,000 ns

SPI_DEVICE_PATH = "/dev/spidev0.0"
SPI_BUS = 0
SPI_DEVICE = 0
LED_GPIO = 10
LED_PHYSICAL_PIN = 19
LED_COUNT = 1   # both fans' LEDs are on the same line in parallel, so each is "LED 1"

_fan_speed = 0.0
_led_color = (0, 0, 0)    # the chosen color, before brightness
_led_brightness = 100.0   # percent
_led_strip = None


# ---- Fan ----------------------------------------------------------------------

def _write_pwm(name: str, value) -> None:
    if SIMULATE_HARDWARE:
        return
    with open(os.path.join(PWM_PATH, name), "w") as f:
        f.write(str(value))


def _configure_pwm() -> None:
    if SIMULATE_HARDWARE:
        return
    if not os.path.exists(PWM_PATH):
        with open(os.path.join(PWM_CHIP, "export"), "w") as f:
            f.write(str(PWM_CHANNEL))
    try:
        _write_pwm("enable", 0)
    except OSError:
        pass
    _write_pwm("period", PWM_PERIOD_NS)


def set_fan_speed(percent: float) -> float:
    """Set the fan from 0 to 100 percent."""
    global _fan_speed
    percent = max(0.0, min(100.0, float(percent)))
    _configure_pwm()
    _write_pwm("duty_cycle", int(PWM_PERIOD_NS * percent / 100))
    _write_pwm("enable", 1 if percent > 0 else 0)
    _fan_speed = percent
    return percent


def get_fan_speed() -> float:
    return _fan_speed


# ---- LED ----------------------------------------------------------------------

def _write_led() -> Dict[str, int]:
    """Send the chosen color, scaled by brightness, to the LED."""
    global _led_strip
    scale = _led_brightness / 100.0
    r, g, b = (round(c * scale) for c in _led_color)
    if not SIMULATE_HARDWARE:
        from rpi5_ws2812.ws2812 import Color, Strip, WS2812SpiDriver
        if _led_strip is None:
            _led_strip = Strip(WS2812SpiDriver(SPI_BUS, SPI_DEVICE, LED_COUNT))
        _led_strip.set_all_pixels(Color(r, g, b))
        _led_strip.show()
    return {"red": r, "green": g, "blue": b}


def set_led_color(red: int, green: int, blue: int) -> Dict[str, int]:
    """Choose the LED color (0-255 per channel); brightness is applied on write."""
    global _led_color
    _led_color = tuple(max(0, min(255, int(c))) for c in (red, green, blue))
    _write_led()
    return get_led_color()


def get_led_color() -> Dict[str, int]:
    r, g, b = _led_color
    return {"red": r, "green": g, "blue": b}


def set_led_brightness(percent: float) -> float:
    """Set LED brightness from 0 to 100 percent, keeping the chosen color."""
    global _led_brightness
    _led_brightness = max(0.0, min(100.0, float(percent)))
    _write_led()
    return _led_brightness


def get_led_brightness() -> float:
    return _led_brightness


def turn_led_off() -> None:
    set_led_brightness(0)


# ---- Status -------------------------------------------------------------------

def status() -> Dict:
    return {
        "fan": {
            "available": SIMULATE_HARDWARE or os.path.exists(PWM_CHIP),
            "simulated": SIMULATE_HARDWARE,
            "pwm_chip": PWM_CHIP,
            "pwm_channel": PWM_CHANNEL,
            "gpio": FAN_GPIO,
            "physical_pin": FAN_PHYSICAL_PIN,
            "frequency_hz": FAN_FREQUENCY_HZ,
            "speed_percent": get_fan_speed(),
        },
        "led": {
            "available": SIMULATE_HARDWARE or os.path.exists(SPI_DEVICE_PATH),
            "simulated": SIMULATE_HARDWARE,
            "type": "WS2812",
            "gpio": LED_GPIO,
            "physical_pin": LED_PHYSICAL_PIN,
            "spi_bus": SPI_BUS,
            "spi_device": SPI_DEVICE,
            "led_count": LED_COUNT,
            "color": get_led_color(),
            "brightness": get_led_brightness(),
        },
    }
