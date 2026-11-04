"""
Bluetooth LED strip bridge.

A small internal service that sends commands to a Bluetooth LE LED strip
controller (the "ELK-BLEDOM" command format, used by many cheap controllers
named LED-xxxxxx or ELK-BLEDOM). The backend calls it over the internal
Docker network; it is never published on the network.

It lives in its own container so the backend doesn't need the host's
D-Bus: this one runs as an unprivileged user, and BlueZ's D-Bus policy
lets such a user use Bluetooth and nothing else.

The connection is opened on the first command and closed after a minute
without commands, so the controller's phone app can still connect (these
controllers accept only one connection at a time).

Env: LED_STRIP_ADDRESS  the controller's Bluetooth address (AA:BB:CC:DD:EE:FF)
"""

import asyncio
import os
import time
from typing import Optional

from bleak import BleakClient, BleakScanner
from dbus_fast import BusType, Message
from dbus_fast.aio import MessageBus
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

ADDRESS = os.environ.get("LED_STRIP_ADDRESS", "").strip().upper()
WRITE_CHAR = "0000ffe1-0000-1000-8000-00805f9b34fb"
SCAN_SECONDS = 10
CONNECT_SECONDS = 15
IDLE_DISCONNECT_SECONDS = 60

_client: Optional[BleakClient] = None
_lock = asyncio.Lock()
_last_used = 0.0
_last_error: Optional[str] = None


# ---- Commands (9 bytes each, framed by 0x7e ... 0xef) --------------------------

def power_command(on: bool) -> bytes:
    return bytes([0x7E, 0x00, 0x04, 0xF0 if on else 0x00, 0x00, 0x01 if on else 0x00, 0xFF, 0x00, 0xEF])


def color_command(red: int, green: int, blue: int) -> bytes:
    return bytes([0x7E, 0x00, 0x05, 0x03, red, green, blue, 0x00, 0xEF])


def brightness_command(percent: int) -> bytes:
    return bytes([0x7E, 0x00, 0x01, percent, 0x00, 0x00, 0x00, 0x00, 0xEF])


# ---- Connection -------------------------------------------------------------

def _on_disconnect(_client_: BleakClient) -> None:
    global _client
    _client = None


async def _release_stale_link() -> bool:
    """Disconnect the strip if BlueZ holds a link that isn't ours.

    BlueZ keeps a connection open after the program that made it goes away
    (e.g. this container was killed). A connected controller stops
    advertising, so it can't be found by a scan until the link is dropped.
    Returns True if a link was dropped.
    """
    path = "/org/bluez/hci0/dev_" + ADDRESS.replace(":", "_")
    bus = await MessageBus(bus_type=BusType.SYSTEM).connect()
    try:
        reply = await bus.call(Message(
            destination="org.bluez", path=path, interface="org.freedesktop.DBus.Properties",
            member="Get", signature="ss", body=["org.bluez.Device1", "Connected"]))
        if reply.body and reply.body[0].value:
            await bus.call(Message(destination="org.bluez", path=path,
                                   interface="org.bluez.Device1", member="Disconnect"))
            await asyncio.sleep(1)
            return True
        return False
    finally:
        bus.disconnect()


async def _connected_client() -> BleakClient:
    global _client
    if _client is not None and _client.is_connected:
        return _client
    device = await BleakScanner.find_device_by_address(ADDRESS, timeout=SCAN_SECONDS)
    if device is None and await _release_stale_link():
        device = await BleakScanner.find_device_by_address(ADDRESS, timeout=SCAN_SECONDS)
    if device is None:
        raise RuntimeError("LED strip not found (out of range, unpowered, or connected to the phone app)")
    client = BleakClient(device, timeout=CONNECT_SECONDS, disconnected_callback=_on_disconnect)
    await client.connect()
    _client = client
    return client


async def _send(*commands: bytes) -> None:
    """Send commands in order, reconnecting once if the link has dropped."""
    global _last_used, _last_error
    if not ADDRESS:
        raise HTTPException(503, "LED_STRIP_ADDRESS is not set")
    async with _lock:
        for attempt in (1, 2):
            try:
                client = await _connected_client()
                for command in commands:
                    await client.write_gatt_char(WRITE_CHAR, command, response=False)
                _last_used = time.monotonic()
                _last_error = None
                return
            except Exception as e:  # bleak raises several error types
                _last_error = str(e) or type(e).__name__
                await _drop()
                if attempt == 2:
                    raise HTTPException(503, _last_error)


async def _drop() -> None:
    global _client
    client, _client = _client, None
    if client is not None:
        try:
            await client.disconnect()
        except Exception:
            pass


async def _idle_disconnect() -> None:
    while True:
        await asyncio.sleep(10)
        if _client is not None and time.monotonic() - _last_used > IDLE_DISCONNECT_SECONDS:
            async with _lock:
                await _drop()


# ---- API ----------------------------------------------------------------------

async def lifespan(_app: FastAPI):
    task = asyncio.create_task(_idle_disconnect())
    yield
    task.cancel()
    await _drop()


app = FastAPI(title="LED strip bridge", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


class Power(BaseModel):
    on: bool


class Color(BaseModel):
    red: int = Field(ge=0, le=255)
    green: int = Field(ge=0, le=255)
    blue: int = Field(ge=0, le=255)


class Brightness(BaseModel):
    brightness: int = Field(ge=0, le=100)


class Apply(Power, Color, Brightness):
    pass


@app.get("/status")
def status():
    return {
        "configured": bool(ADDRESS),
        "connected": _client is not None and _client.is_connected,
        "last_error": _last_error,
    }


@app.post("/power")
async def power(body: Power):
    await _send(power_command(body.on))
    return {"ok": True}


@app.post("/color")
async def color(body: Color):
    await _send(color_command(body.red, body.green, body.blue))
    return {"ok": True}


@app.post("/brightness")
async def brightness(body: Brightness):
    await _send(brightness_command(body.brightness))
    return {"ok": True}


@app.post("/apply")
async def apply(body: Apply):
    """Set everything at once (used to re-apply saved settings)."""
    commands = [power_command(body.on)]
    if body.on:
        commands += [color_command(body.red, body.green, body.blue), brightness_command(body.brightness)]
    await _send(*commands)
    return {"ok": True}
