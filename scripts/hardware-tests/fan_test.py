import lgpio
import time

GPIO = 18
FREQUENCY = 25000
DUTY = 100

h = lgpio.gpiochip_open(0)

try:
    lgpio.gpio_claim_output(h, GPIO)

    print(f"Starting {FREQUENCY} Hz PWM at {DUTY}% duty cycle")
    lgpio.tx_pwm(h, GPIO, FREQUENCY, DUTY)

    print("PWM running. Press Ctrl+C to stop.")

    while True:
        time.sleep(1)

except KeyboardInterrupt:
    print("\nStopping PWM...")
    lgpio.tx_pwm(h, GPIO, 0, 0)

finally:
    lgpio.gpiochip_close(h)
