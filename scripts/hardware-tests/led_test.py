from rpi5_ws2812.ws2812 import Color, WS2812SpiDriver
import time

# Your fan has 2 WS2812 LEDs
strip = WS2812SpiDriver(
    spi_bus=0,
    spi_device=0,
    led_count=2
).get_strip()

try:
    print("RED")
    strip.set_all_pixels(Color(255, 0, 0))
    strip.show()
    time.sleep(2)

    print("GREEN")
    strip.set_all_pixels(Color(0, 255, 0))
    strip.show()
    time.sleep(2)

    print("BLUE")
    strip.set_all_pixels(Color(0, 0, 255))
    strip.show()
    time.sleep(2)

    print("WHITE")
    strip.set_all_pixels(Color(255, 255, 255))
    strip.show()
    time.sleep(2)

    print("OFF")
    strip.set_all_pixels(Color(0, 0, 0))
    strip.show()

finally:
    strip.set_all_pixels(Color(0, 0, 0))
    strip.show()
