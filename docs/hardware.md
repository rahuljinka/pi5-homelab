# Hardware

| Part | Model | Notes |
|---|---|---|
| Board | Raspberry Pi 5 Model B, 8 GB | Broadcom BCM2712, 4 × Cortex-A76 at 2.4 GHz |
| System drive | Crucial P3 500 GB NVMe SSD (CT500P3SSD8) | On a Pimoroni NVMe Base (single M.2 slot), PCIe |
| Data drive | WD Elements Portable 500 GB | WD Scorpio Blue inside: 2.5", 5400 rpm, over USB 3 |
| Display | Waveshare 3.5" HDMI LCD | Driven at 800×480, rotated to portrait (480×800). Its resistive touch isn't used. |
| Fan | 4-pin PWM fan | Speed from 0–100 % at 25 kHz |
| LED | One WS2812 RGB LED | Colour and brightness from the control panel |
| OS | Raspberry Pi OS 64-bit (Debian 13 "trixie") | Kernel 6.18 |

## Wiring

| Signal | GPIO | Physical pin | Kernel interface |
|---|---|---|---|
| Fan PWM | GPIO 18 | 12 | `/sys/class/pwm/pwmchip0`, channel 2 |
| LED data | GPIO 10 (SPI0 MOSI) | 19 | `/dev/spidev0.0` |
| 5 V / GND | — | 2 or 4 / 6 | power for fan and LED |

The WS2812 is driven over SPI rather than bit-banged GPIO: the SPI clock
produces the LED's timing exactly, which works reliably on the Pi 5.

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
