import time
from rpi5_ws2812.ws2812 import Color, WS2812SpiDriver

# -------------------------
# PWM FAN
# -------------------------
PWM_CHIP = "/sys/class/pwm/pwmchip0"
PWM_CHANNEL = 2

PERIOD = 40000  # 25 kHz

def write_file(path, value):
    with open(path, "w") as f:
        f.write(str(value))

def setup_pwm():
    pwm = f"{PWM_CHIP}/pwm{PWM_CHANNEL}"

    try:
        write_file(f"{PWM_CHIP}/export", PWM_CHANNEL)
    except OSError:
        pass

    write_file(f"{pwm}/enable", 0)
    write_file(f"{pwm}/period", PERIOD)
    write_file(f"{pwm}/duty_cycle", 0)

    return pwm

def set_fan_speed(pwm, percent):
    percent = max(0, min(100, percent))
    duty = int(PERIOD * percent / 100)

    write_file(f"{pwm}/enable", 0)
    write_file(f"{pwm}/duty_cycle", duty)
    write_file(f"{pwm}/enable", 1)


# -------------------------
# WS2812 LEDs
# -------------------------
leds = WS2812SpiDriver(
    spi_bus=0,
    spi_device=0,
    led_count=2
).get_strip()

def set_leds(r, g, b):
    leds.set_all_pixels(Color(r, g, b))
    leds.show()


# -------------------------
# TEST
# -------------------------
pwm = setup_pwm()

try:
    print("Fan 25% + RED")
    set_fan_speed(pwm, 25)
    set_leds(255, 0, 0)
    time.sleep(3)

    print("Fan 50% + GREEN")
    set_fan_speed(pwm, 50)
    set_leds(0, 255, 0)
    time.sleep(3)

    print("Fan 75% + BLUE")
    set_fan_speed(pwm, 75)
    set_leds(0, 0, 255)
    time.sleep(3)

    print("Fan 100% + WHITE")
    set_fan_speed(pwm, 100)
    set_leds(255, 255, 255)
    time.sleep(3)

    print("Fan 50% + PURPLE")
    set_fan_speed(pwm, 50)
    set_leds(255, 0, 255)
    time.sleep(3)

finally:
    print("Stopping fan and LEDs")
    set_fan_speed(pwm, 0)
    set_leds(0, 0, 0)

    try:
        write_file(f"{pwm}/enable", 0)
    except Exception:
        pass
