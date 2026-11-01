"""
Who may use the API.

The backend is never exposed on the network. Two web servers forward to it:

* The control panel (port 3000). Every request needs a logged-in session
  (an HttpOnly cookie), except the login endpoints themselves. Requests
  that change something must also carry `X-Requested-With: fetch`, which
  browsers won't let other websites add, so a page elsewhere can't make
  your browser send commands.

* The kiosk display (only reachable from the Pi itself). Its web server
  adds a shared secret header (DISPLAY_KEY); requests with it may only use
  the read-only endpoints the display needs, plus reporting which clock
  photo is showing.

First run: there is no password yet, so the backend prints a one-time
setup code to its log (`docker compose logs backend`). Enter it in the
panel to create the password. To reset the password, delete
data/auth.json and restart the backend.

The password is stored only as a scrypt hash, sessions only as SHA-256
hashes, in data/auth.json.
"""

import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import threading
import time

from fastapi import Request
from fastapi.responses import JSONResponse

from .settings import AUTH_DISABLED, DATA_DIR, DISPLAY_KEY, SESSION_DAYS

AUTH_FILE = os.path.join(DATA_DIR, "auth.json")
COOKIE = "pdm_session"

PUBLIC_PATHS = {"/auth/status", "/auth/login", "/auth/setup", "/health"}

# What the kiosk display may call (method, path pattern).
DISPLAY_ALLOWED = [
    ("GET", re.compile(r"^/screen$")),
    ("GET", re.compile(r"^/weather$")),
    ("GET", re.compile(r"^/clock/photos(/[^/]+)?$")),
    ("GET", re.compile(r"^/clock/current$")),
    ("POST", re.compile(r"^/clock/showing$")),
    ("GET", re.compile(r"^/media/current$")),
    ("GET", re.compile(r"^/media/[^/]+$")),
]

_lock = threading.Lock()
_setup_code = None
_failures = []  # timestamps of recent failed logins


# ---- Storage ------------------------------------------------------------------

def _load() -> dict:
    try:
        with open(AUTH_FILE) as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def _save(data: dict) -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    tmp = AUTH_FILE + ".tmp"
    with open(os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), "w") as f:
        json.dump(data, f)
    os.replace(tmp, AUTH_FILE)


# ---- Passwords --------------------------------------------------------------

def _hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**15, r=8, p=1, maxmem=64 * 1024 * 1024)
    return "scrypt$" + base64.b64encode(salt).decode() + "$" + base64.b64encode(digest).decode()


def _check_password(password: str, stored: str) -> bool:
    try:
        _, salt_b64, digest_b64 = stored.split("$")
        salt, expected = base64.b64decode(salt_b64), base64.b64decode(digest_b64)
    except ValueError:
        return False
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**15, r=8, p=1, maxmem=64 * 1024 * 1024)
    return hmac.compare_digest(digest, expected)


def password_is_set() -> bool:
    return bool(_load().get("password_hash"))


def init() -> None:
    """On startup: print a one-time setup code if no password exists yet."""
    global _setup_code
    if AUTH_DISABLED:
        print("Auth: login disabled (dev mode).", flush=True)
    elif not password_is_set():
        _setup_code = "-".join(secrets.token_hex(2).upper() for _ in range(3))
        print(f"Auth: no panel password yet. One-time setup code: {_setup_code}", flush=True)


# ---- Sessions ---------------------------------------------------------------

def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _new_session(data: dict) -> str:
    token = secrets.token_urlsafe(32)
    now = time.time()
    sessions = {h: exp for h, exp in data.get("sessions", {}).items() if exp > now}
    sessions[_token_hash(token)] = now + SESSION_DAYS * 86400
    data["sessions"] = sessions
    _save(data)
    return token


def _session_valid(request: Request) -> bool:
    token = request.cookies.get(COOKIE)
    if not token:
        return False
    exp = _load().get("sessions", {}).get(_token_hash(token))
    return bool(exp and exp > time.time())


def _with_cookie(response: JSONResponse, token: str) -> JSONResponse:
    response.set_cookie(COOKIE, token, max_age=SESSION_DAYS * 86400,
                        httponly=True, samesite="strict", path="/")
    return response


def _too_many_failures() -> bool:
    now = time.time()
    _failures[:] = [t for t in _failures if now - t < 300]
    return len(_failures) >= 5


# ---- Endpoints (registered in main.py) ----------------------------------------

def status(request: Request) -> dict:
    return {
        "authenticated": AUTH_DISABLED or _session_valid(request),
        "setup_required": not AUTH_DISABLED and not password_is_set(),
        "auth_disabled": AUTH_DISABLED,
    }


def setup(code: str, password: str) -> JSONResponse:
    global _setup_code
    with _lock:
        if password_is_set() or not _setup_code:
            return JSONResponse({"detail": "A password is already set."}, status_code=409)
        if not hmac.compare_digest(code.strip().upper(), _setup_code):
            _failures.append(time.time())
            return JSONResponse({"detail": "That setup code isn't right."}, status_code=403)
        if len(password) < 10:
            return JSONResponse({"detail": "Use at least 10 characters."}, status_code=422)
        data = {"password_hash": _hash_password(password)}
        _setup_code = None
        return _with_cookie(JSONResponse({"ok": True}), _new_session(data))


def login(password: str) -> JSONResponse:
    with _lock:
        if _too_many_failures():
            return JSONResponse({"detail": "Too many attempts. Wait 5 minutes."}, status_code=429)
        data = _load()
        if not data.get("password_hash") or not _check_password(password, data["password_hash"]):
            _failures.append(time.time())
            return JSONResponse({"detail": "Wrong password."}, status_code=401)
        return _with_cookie(JSONResponse({"ok": True}), _new_session(data))


def logout(request: Request) -> JSONResponse:
    token = request.cookies.get(COOKIE)
    if token:
        with _lock:
            data = _load()
            data.get("sessions", {}).pop(_token_hash(token), None)
            _save(data)
    response = JSONResponse({"ok": True})
    response.delete_cookie(COOKIE, path="/")
    return response


# ---- Gatekeeper -----------------------------------------------------------------

async def guard(request: Request, call_next):
    """Middleware: decide whether a request may reach its endpoint."""
    method = request.method
    path = request.url.path
    if path.startswith("/api"):
        path = path[len("/api"):] or "/"

    if AUTH_DISABLED or path in PUBLIC_PATHS:
        return await call_next(request)

    key = request.headers.get("x-display-key", "")
    if DISPLAY_KEY and key and hmac.compare_digest(key, DISPLAY_KEY):
        if any(method == m and pattern.match(path) for m, pattern in DISPLAY_ALLOWED):
            return await call_next(request)
        return JSONResponse({"detail": "Not allowed for the display."}, status_code=403)

    if not _session_valid(request):
        return JSONResponse({"detail": "Log in to the control panel."}, status_code=401)

    if method not in ("GET", "HEAD", "OPTIONS") and request.headers.get("x-requested-with") != "fetch":
        return JSONResponse({"detail": "Missing X-Requested-With header."}, status_code=403)

    return await call_next(request)
