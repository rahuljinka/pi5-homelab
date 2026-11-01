from rpi_hardware_pwm import HardwarePWM
import time

# GPIO18 = PWM channel 2 on Raspberry Pi 5
pwm = HardwarePWM(pwm_channel=2, hz=25000, chip=0)

print("Starting GPIO18 PWM at 100%")

pwm.start(100)

try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    print("\nStopping PWM")
    pwm.stop()

