# Hardware

| Part | Model | Notes |
|---|---|---|
| Board | Raspberry Pi 5 Model B, 8 GB | Broadcom BCM2712, 4 × Cortex-A76 at 2.4 GHz |
| System drive | Crucial P3 500 GB NVMe SSD (CT500P3SSD8) | On a Pimoroni NVMe Base (single M.2 slot), PCIe |
| Data drive | WD Elements Portable 500 GB | WD Scorpio Blue inside: 2.5", 5400 rpm, over USB 3 |
| Display | Waveshare 3.5" HDMI LCD | Driven at 800×480, rotated to portrait (480×800). Its resistive touch isn't used. |
| Fans | 2 × 4010 RGB PWM fan (40 × 40 × 10 mm, 5 V) | Wired in parallel: one speed (0–100 % at 25 kHz) and one LED colour/brightness for both, from the control panel. [Details below](#the-fans). |
| LED strip | Bluetooth LE strip controller (ELK-BLEDOM command format) | Power, colour and brightness from the control panel, via the Pi's built-in Bluetooth |
| Lamp | Govee H6076 table lamp (Wi-Fi) | Power, colour, white temperature and brightness over Govee's LAN API (no cloud) |
| OS | Raspberry Pi OS 64-bit (Debian 13 "trixie") | Kernel 6.18 |

## Wiring

| Signal | Fan wire | GPIO | Physical pin | Kernel interface |
|---|---|---|---|---|
| +5 V | Red | — | 2 or 4 | power for the fans and their LEDs |
| GND | Black | — | 6 | |
| Fan PWM | Blue (both fans, joined by a 2-to-1 cable) | GPIO 18 | 12 | `/sys/class/pwm/pwmchip0`, channel 2 |
| LED data (WS2812) | Green (both fans, joined by a 2-to-1 cable) | GPIO 10 (SPI0 MOSI) | 19 | `/dev/spidev0.0` |

The WS2812 is driven over SPI rather than bit-banged GPIO: the SPI clock
produces the LED's timing exactly, which works reliably on the Pi 5.

## The fans

Two 4010 RGB PWM fans: 4-wire fans with a WS2812 RGB LED built in, so each
fan and its LED share power and ground.

Both fans' blue (PWM) wires are joined into one with a 2-to-1 cable that
goes to GPIO 18, and both green (WS2812 data) wires the same way into
GPIO 10. So the Pi drives them as one: they always run at the same speed,
and both LEDs receive the same data and show the same colour. The software
treats them as a single fan with a single LED (`LED_COUNT = 1`), which is
exactly what each LED sees on the shared line.

From the spec sheet (per fan):

| Spec | Value |
|---|---|
| Size | 40 × 40 × 10 mm |
| Motor | Brushless DC, PWM speed control |
| Power | 5 V, 0.25 A max (1.25 W) |
| Max speed | 5500 rpm |
| Max airflow | 7.13 CFM |
| Max noise | 25.6 dB |
| MTBF | 30,000 hours |
| LED | WS2812 RGB |
| Protection | Reverse polarity |
| Wires | Red +5 V · Black GND · Blue PWM · Green WS2812 data |

Both fans together draw at most 0.5 A at full speed, well within what the
Pi 5's 5 V pins can supply. The PWM and LED data lines run at 3.3 V straight from the GPIO
pins, which both inputs accept.

## Boot settings

From [`host/boot/config.txt`](../host/boot/config.txt):

```ini
[pi5]
dtoverlay=pwm-2chan,pin=18,func=2   # hardware PWM on GPIO 18 for the fan

[all]
dtparam=spi=on                      # SPI0 for the LED
dtoverlay=spi0-1cs
```

## The display

The kiosk session ([`host/kiosk/xinitrc`](../host/kiosk/xinitrc)) rotates
the panel to portrait with `xrandr --output HDMI-1 --rotate left` and opens
Chromium in app mode. A normal Chromium window can't be narrower than about
500 px, which overflowed the 480 px-wide screen; app mode has no tab strip
and fits exactly.

## Testing the hardware directly

[`scripts/hardware-tests/`](../scripts/hardware-tests/) has small scripts
for checking the fan and LED without the display manager.
