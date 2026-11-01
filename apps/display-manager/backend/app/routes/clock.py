"""
Clock screen wallpapers.

Photos live in media/clock-photos/ (mounted at CLOCK_PHOTO_DIR). They're
served resized for the portrait screen, rotated per their EXIF
orientation and converted to JPEG, so iPhone HEIC photos work too. The
resized copies are cached in data/clock-cache/ and removed when the
original is deleted.

Modes: "slideshow" rotates every 10 minutes (the display does the timing);
"single" stays on one chosen photo. "Show now" jumps to a photo; in
single mode it also becomes the chosen photo.
"""

import hashlib
import os
import shutil
import time
import uuid
from typing import Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from PIL import Image, ImageOps
from pillow_heif import register_heif_opener
from pydantic import BaseModel

from .. import state
from ..settings import CLOCK_PHOTO_DIR, DATA_DIR

register_heif_opener()

router = APIRouter(prefix="/clock", tags=["clock"])

CACHE_DIR = os.path.join(DATA_DIR, "clock-cache")
MAX_SIZE = (960, 1600)  # 2x the 480x800 screen
EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}

# Image format (as Pillow names it) -> extension used when saving uploads.
FORMATS = {"JPEG": ".jpg", "MPO": ".jpg", "PNG": ".png", "WEBP": ".webp", "HEIF": ".heic"}
FORMAT_BY_EXT = {".jpg": ".jpg", ".jpeg": ".jpg", ".png": ".png", ".webp": ".webp", ".heic": ".heic", ".heif": ".heic"}


class ClockPhotoUpdate(BaseModel):
    file: Optional[str] = None


class ClockModeUpdate(BaseModel):
    mode: str
    file: Optional[str] = None


# ---- Helpers ------------------------------------------------------------------

def list_photos():
    try:
        names = os.listdir(CLOCK_PHOTO_DIR)
    except OSError:
        return []
    return sorted(
        n for n in names
        if not n.startswith(".")
        and os.path.splitext(n)[1].lower() in EXTENSIONS
        and os.path.isfile(os.path.join(CLOCK_PHOTO_DIR, n))
    )


def _cache_path(name):
    # Keyed on name + modified time + size, so a replaced photo gets a fresh copy.
    st = os.stat(os.path.join(CLOCK_PHOTO_DIR, name))
    key = hashlib.sha1(f"{name}:{st.st_mtime_ns}:{st.st_size}".encode()).hexdigest()
    return os.path.join(CACHE_DIR, f"{key}.jpg")


def _prune_cache(photos):
    keep = set()
    for name in photos:
        try:
            keep.add(os.path.basename(_cache_path(name)))
        except OSError:
            pass
    try:
        cached = os.listdir(CACHE_DIR)
    except OSError:
        return
    for name in cached:
        if name not in keep:
            try:
                os.remove(os.path.join(CACHE_DIR, name))
            except OSError:
                pass


def _unique_name(filename):
    base, ext = os.path.splitext(filename)
    candidate, n = filename, 2
    while os.path.exists(os.path.join(CLOCK_PHOTO_DIR, candidate)):
        candidate, n = f"{base} ({n}){ext}", n + 1
    return candidate


def _current():
    return {**state.clock_photo_state, **{f"mode_{k}": v for k, v in state.clock_photo_mode.items()}}


# ---- Photos ---------------------------------------------------------------------

@router.get("/photos")
def get_photos():
    """Photo names in the folder (also clears cached copies of removed photos)."""
    photos = list_photos()
    _prune_cache(photos)
    return {"photos": photos}


@router.post("/photos")
def upload_photos(files: list[UploadFile] = File(...)):
    """Add photos. Each file is checked by its contents, not its name, so a
    HEIC sent as "image" or misnamed ".jpg" is saved with the right extension."""
    saved, skipped = [], []
    for upload in files:
        original = upload.filename or ""
        base, ext = os.path.splitext(os.path.basename(original.replace("\\", "/")).strip())
        if not base or base.startswith("."):
            base = time.strftime("photo-%Y%m%d-%H%M%S")  # phones sometimes send no name

        tmp = os.path.join(CLOCK_PHOTO_DIR, f".uploading-{uuid.uuid4().hex}")
        with open(tmp, "wb") as buffer:
            shutil.copyfileobj(upload.file, buffer)
        try:
            with Image.open(tmp) as image:
                detected = FORMATS.get(image.format)
        except Exception:
            detected = None
        if not detected:
            os.remove(tmp)
            skipped.append(original or "(unnamed file)")
            continue

        if ext.lower() not in EXTENSIONS or FORMAT_BY_EXT.get(ext.lower()) != detected:
            ext = detected
        name = _unique_name(f"{base}{ext}")
        os.chmod(tmp, 0o664)
        os.replace(tmp, os.path.join(CLOCK_PHOTO_DIR, name))
        saved.append(name)
    return {"saved": saved, "skipped": skipped}


@router.get("/photos/{filename}")
def get_photo(filename: str):
    """A photo resized for the screen, as JPEG."""
    if filename not in list_photos():
        raise HTTPException(status_code=404, detail="Photo not found")
    cached = _cache_path(filename)
    if not os.path.exists(cached):
        os.makedirs(CACHE_DIR, exist_ok=True)
        try:
            with Image.open(os.path.join(CLOCK_PHOTO_DIR, filename)) as image:
                image = ImageOps.exif_transpose(image)
                image.thumbnail(MAX_SIZE, Image.LANCZOS)
                tmp = cached + ".tmp"
                image.convert("RGB").save(tmp, "JPEG", quality=88, optimize=True)
                os.replace(tmp, cached)
        except Exception as e:
            raise HTTPException(status_code=415, detail=f"Could not read photo: {e}")
    return FileResponse(cached, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=86400"})


@router.delete("/photos/{filename}")
def delete_photo(filename: str):
    if filename not in list_photos():
        raise HTTPException(status_code=404, detail="Photo not found")
    os.remove(os.path.join(CLOCK_PHOTO_DIR, filename))
    _prune_cache(list_photos())
    if state.clock_photo_mode["file"] == filename:
        # Deleting the chosen single photo falls back to the slideshow.
        state.clock_photo_mode.update(mode="slideshow", file=None)
        state.save()
    return {"deleted": filename}


# ---- What's on screen -----------------------------------------------------------

@router.get("/current")
def get_current():
    """Mode (`mode_mode`, `mode_file`), the latest "show now" request, and
    the photo the display reports showing."""
    return _current()


@router.post("/current")
def show_now(data: ClockPhotoUpdate):
    """Jump to a photo; in single mode it also becomes the chosen photo."""
    if data.file not in list_photos():
        raise HTTPException(status_code=404, detail="Photo not found")
    state.clock_photo_state.update(request_file=data.file, request_id=time.time_ns())
    if state.clock_photo_mode["mode"] == "single":
        state.clock_photo_mode["file"] = data.file
        state.save()
    return _current()


@router.post("/mode")
def set_mode(data: ClockModeUpdate):
    """Switch between "slideshow" and "single". Single keeps the requested
    photo, else the one on screen now, else the first photo."""
    if data.mode not in ("slideshow", "single"):
        raise HTTPException(status_code=422, detail="mode must be 'slideshow' or 'single'")
    photos = list_photos()
    state.clock_photo_mode["mode"] = data.mode
    if data.mode == "single":
        choice = data.file or state.clock_photo_state["showing"]
        if choice not in photos:
            choice = photos[0] if photos else None
        state.clock_photo_mode["file"] = choice
    state.save()
    return _current()


@router.post("/showing")
def report_showing(data: ClockPhotoUpdate):
    """The display reports which photo it is showing."""
    state.clock_photo_state["showing"] = data.file
    return {"success": True}
