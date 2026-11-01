"""
System information and power controls.

* Stats come from psutil. CPU is measured since the previous request, so
  requests return immediately instead of pausing to sample.
* Containers are listed through a read-only Docker API proxy (see
  compose.yaml); the backend has no direct access to Docker.
* Reboot and Shutdown drop a request file into data/host-requests/. A small
  systemd helper on the Pi (host/display-manager-power/) watches that
  folder and can only reboot or power off. The backend itself can't run
  anything on the host.
* Restart Backend exits the process; Docker's restart policy starts it
  again within a few seconds.
"""

import json
import os
import threading
import time
from datetime import datetime, timezone

import docker
import psutil
from fastapi import APIRouter, HTTPException

from ..settings import DRIVES, HOST_REQUEST_DIR, PI_ADDRESS, SIMULATE_HARDWARE

router = APIRouter(tags=["system"])

psutil.cpu_percent(None)  # start the CPU measurement window
_docker = None


def _format_uptime(seconds: float) -> str:
    seconds = int(seconds)
    parts = [(seconds // 86400, "day"), ((seconds % 86400) // 3600, "hour"), ((seconds % 3600) // 60, "minute")]
    return " ".join(f"{n} {unit}{'s' if n != 1 else ''}" for n, unit in parts if n) or "just started"


def _drive_usage():
    """Usage per configured drive. The first drive is the system drive; any
    other drive whose folder sits on the system drive isn't mounted (Docker
    recreates a missing mount folder on the system drive)."""
    drives = []
    system_dev = None
    for i, drive in enumerate(DRIVES):
        try:
            dev = os.stat(drive["path"]).st_dev
            if i == 0:
                system_dev = dev
            elif dev == system_dev:
                raise OSError("not mounted")
            usage = psutil.disk_usage(drive["path"])
        except OSError:
            drives.append({"name": drive["name"], "available": False})
            continue
        drives.append({
            "name": drive["name"],
            "available": True,
            "used": usage.used,
            "free": usage.free,
            "total": usage.total,
            "percent": usage.percent,
        })
    return drives


@router.get("/stats")
def get_stats():
    """CPU, memory, drives, temperature and uptime of the Pi."""
    memory = psutil.virtual_memory()
    try:
        with open("/sys/class/thermal/thermal_zone0/temp") as f:
            temperature = int(f.read()) / 1000
    except (OSError, ValueError):
        temperature = None

    return {
        "hostname": os.uname().nodename,
        "ip": PI_ADDRESS,
        "cpu": psutil.cpu_percent(None),
        "ram_used": memory.used,
        "ram_total": memory.total,
        "ram_percent": memory.percent,
        "drives": _drive_usage(),
        "temperature": temperature,
        "uptime": _format_uptime(time.time() - psutil.boot_time()),
    }


@router.get("/containers")
def get_containers():
    """Every Docker container on the Pi with its image and state."""
    global _docker
    try:
        if _docker is None:
            _docker = docker.from_env(timeout=5)
        listed = _docker.api.containers(all=True)
    except Exception as e:
        print(f"Containers unavailable: {e}", flush=True)
        _docker = None
        return []
    return [
        {"name": c["Names"][0].lstrip("/"), "image": c.get("Image", "unknown"), "status": c.get("State", "unknown")}
        for c in listed
    ]


DRIVE_HEALTH_FILE = os.path.join(os.path.dirname(HOST_REQUEST_DIR), "drive-health.json")
DRIVE_HEALTH_STALE_SECONDS = 2 * 3600


def _grade(drive: dict) -> tuple:
    """(status, reasons) for one drive: good, warning or failing."""
    if drive.get("passed") is False:
        return "failing", ["The drive's own SMART check reports it is failing"]
    reasons = []
    for key, label in (("reallocated_sectors", "reallocated"), ("pending_sectors", "pending"),
                       ("uncorrectable_sectors", "uncorrectable")):
        if drive.get(key):
            reasons.append(f"{drive[key]} {label} sectors")
    if drive.get("media_errors"):
        reasons.append(f"{drive['media_errors']} media errors")
    if (drive.get("wear_percent") or 0) >= 80:
        reasons.append(f"{drive['wear_percent']}% worn")
    limit = 70 if drive.get("type") == "nvme" else 55
    if (drive.get("temperature_c") or 0) >= limit:
        reasons.append(f"running hot ({drive['temperature_c']} °C)")
    test = drive.get("last_self_test")
    if test and test.get("passed") is False:
        reasons.append(f"last self-test: {test.get('result')}")
    return ("warning" if reasons else "good"), reasons


@router.get("/drives/health")
def get_drive_health():
    """SMART health per drive, saved by the host job host/drive-health/ (every 30 minutes)."""
    try:
        with open(DRIVE_HEALTH_FILE) as f:
            report = json.load(f)
    except (OSError, ValueError):
        return {"available": False, "drives": []}
    try:
        checked = datetime.fromisoformat(report["checked_at"])
        age = (datetime.now(timezone.utc) - checked).total_seconds()
    except (KeyError, ValueError):
        age = None
    drives = []
    for drive in report.get("drives", []):
        status, reasons = _grade(drive)
        drives.append({**drive, "status": status, "reasons": reasons})
    return {
        "available": True,
        "checked_at": report.get("checked_at"),
        "stale": age is None or age > DRIVE_HEALTH_STALE_SECONDS,
        "drives": drives,
    }


def _request_host_action(action: str) -> dict:
    if SIMULATE_HARDWARE:
        return {"success": True, "message": f"Simulated {action} (dev mode)."}
    if not os.path.isdir(HOST_REQUEST_DIR):
        raise HTTPException(status_code=503, detail="The power helper isn't installed on this Pi.")
    with open(os.path.join(HOST_REQUEST_DIR, action), "w") as f:
        f.write(str(time.time()))
    return {"success": True}


@router.post("/system/reboot")
def reboot_pi():
    return {**_request_host_action("reboot"), "message": "Rebooting"}


@router.post("/system/shutdown")
def shutdown_pi():
    return {**_request_host_action("poweroff"), "message": "Shutting down"}


@router.post("/system/restart-backend")
def restart_backend():
    def stop():
        time.sleep(1)  # let the response reach the browser first
        os._exit(0)

    threading.Thread(target=stop, daemon=True).start()
    return {"success": True, "message": "Restarting backend"}
