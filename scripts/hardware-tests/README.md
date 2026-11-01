# Hardware tests

Small scripts I use to check the fan and LED wiring directly, without the
display manager. Stop the display manager first (`docker compose down` in
`apps/display-manager`) so the two don't fight over the hardware.

| Script | Tests |
|---|---|
| `pwm_test.py` | the PWM channel on GPIO 18 exists and accepts a 25 kHz signal |
| `fan_test.py` | fan speed steps (0 → 100 %) |
| `led_test.py` | WS2812 LED colours over SPI0 (GPIO 10) |
| `fan_led_test.py` | both together |

Setup (once), then run with `sudo` because they write to `/sys` and `/dev/spidev0.0`:

```sh
python3 -m venv ~/pwm-env
~/pwm-env/bin/pip install rpi5-ws2812==0.1.3
sudo ~/pwm-env/bin/python scripts/hardware-tests/fan_test.py
```

Both need the boot settings in [`host/boot/config.txt`](../../host/boot/config.txt).
