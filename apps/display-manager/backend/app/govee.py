"""
Govee Wi-Fi lights over Govee's LAN API.

Each light is set in .env as GOVEE_LIGHTS="Name=ip;Name=ip". "LAN Control"
must be switched on for it in the Govee Home app. Nothing goes through
Govee's cloud.

Protocol (JSON over UDP): commands go to the light's port 4003; the light
answers status requests by sending to port 4002 on the asking machine (not
to the port the request came from), so compose.yaml publishes 4002/udp to
the backend. Replies from addresses that aren't configured lights are
ignored.

Give each light a fixed address (a DHCP reservation on the router), since
the configured IP is how it's found.

With SIMULATE_HARDWARE set (dev), lights are pretend and kept in memory.
"""

import json
import socket
import threading
import time
from typing import Dict, List, Optional

from .settings import GOVEE_LIGHTS, SIMULATE_HARDWARE

COMMAND_PORT = 4003
REPLY_PORT = 4002
STATUS_TIMEOUT_SECONDS = 2.0
SETTLE_SECONDS = 0.4          # time for a light to apply a command before re-reading it
KELVIN_RANGE = (2000, 9000)

_lock = threading.Lock()
_socket: Optional[socket.socket] = None
_simulated: Dict[str, Dict] = {}


class GoveeError(Exception):
    pass


def lights() -> List[Dict[str, str]]:
    return GOVEE_LIGHTS


def _find(index: int) -> Dict[str, str]:
    if not 0 <= index < len(GOVEE_LIGHTS):
        raise GoveeError("No such light")
    return GOVEE_LIGHTS[index]


def _sock() -> socket.socket:
    global _socket
    if _socket is None:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.bind(("0.0.0.0", REPLY_PORT))
        _socket = s
    return _socket


def _send(ip: str, cmd: str, data: Dict) -> None:
    payload = json.dumps({"msg": {"cmd": cmd, "data": data}}).encode()
    try:
        _sock().sendto(payload, (ip, COMMAND_PORT))
    except OSError as e:
        raise GoveeError(f"Could not reach the light: {e}") from e


def _read_status(ip: str) -> Dict:
    """Ask a light for its state and wait for its reply (lock held)."""
    s = _sock()
    s.setblocking(False)       # drop anything left over from earlier
    try:
        while True:
            s.recvfrom(4096)
    except (BlockingIOError, OSError):
        pass
    s.setblocking(True)

    _send(ip, "devStatus", {})
    deadline = time.monotonic() + STATUS_TIMEOUT_SECONDS
    while (remaining := deadline - time.monotonic()) > 0:
        s.settimeout(remaining)
        try:
            data, (sender, _port) = s.recvfrom(4096)
        except socket.timeout:
            break
        if sender != ip:
            continue
        try:
            msg = json.loads(data)["msg"]
        except (ValueError, KeyError, TypeError):
            continue
        if msg.get("cmd") == "devStatus":
            return msg.get("data", {})
    raise GoveeError("The light didn't answer (is it powered, and is LAN Control on?)")


def _simulated_state(ip: str) -> Dict:
    return _simulated.setdefault(ip, {
        "onOff": 1, "brightness": 100, "color": {"r": 255, "g": 255, "b": 255}, "colorTemInKelvin": 0,
    })


def _shape(index: int, light: Dict[str, str], raw: Dict) -> Dict:
    color = raw.get("color") or {}
    return {
        "index": index,
        "name": light["name"],
        "online": True,
        "simulated": SIMULATE_HARDWARE,
        "on": bool(raw.get("onOff")),
        "brightness": int(raw.get("brightness", 0)),
        "color": {"red": color.get("r", 0), "green": color.get("g", 0), "blue": color.get("b", 0)},
        # 0 means the light is showing a colour, not a white temperature.
        "kelvin": int(raw.get("colorTemInKelvin") or 0),
        "kelvin_range": list(KELVIN_RANGE),
    }


def status(index: int) -> Dict:
    light = _find(index)
    if SIMULATE_HARDWARE:
        return _shape(index, light, _simulated_state(light["ip"]))
    with _lock:
        return _shape(index, light, _read_status(light["ip"]))


def all_status() -> List[Dict]:
    result = []
    for index, light in enumerate(GOVEE_LIGHTS):
        try:
            result.append(status(index))
        except GoveeError as e:
            result.append({"index": index, "name": light["name"], "online": False, "error": str(e)})
    return result


def _command(index: int, cmd: str, data: Dict, simulate) -> Dict:
    """Send a command, then read the light back so the panel shows its real state."""
    light = _find(index)
    if SIMULATE_HARDWARE:
        simulate(_simulated_state(light["ip"]))
        return status(index)
    with _lock:
        _send(light["ip"], cmd, data)
        time.sleep(SETTLE_SECONDS)
        try:
            return _shape(index, light, _read_status(light["ip"]))
        except GoveeError:
            # The command was sent; the light just didn't report back in time.
            return {"index": index, "name": light["name"], "online": True, "pending": True}


def set_power(index: int, on: bool) -> Dict:
    return _command(index, "turn", {"value": 1 if on else 0},
                    lambda s: s.update(onOff=int(on)))


def set_brightness(index: int, percent: int) -> Dict:
    percent = max(1, min(100, int(percent)))
    return _command(index, "brightness", {"value": percent},
                    lambda s: s.update(onOff=1, brightness=percent))


def set_color(index: int, red: int, green: int, blue: int) -> Dict:
    rgb = {"r": int(red), "g": int(green), "b": int(blue)}
    return _command(index, "colorwc", {"color": rgb, "colorTemInKelvin": 0},
                    lambda s: s.update(onOff=1, color=rgb, colorTemInKelvin=0))


def set_kelvin(index: int, kelvin: int) -> Dict:
    kelvin = max(KELVIN_RANGE[0], min(KELVIN_RANGE[1], int(kelvin)))
    return _command(index, "colorwc", {"color": {"r": 0, "g": 0, "b": 0}, "colorTemInKelvin": kelvin},
                    lambda s: s.update(onOff=1, colorTemInKelvin=kelvin))
