"""
Media Library: GIFs, images and videos for the Media screen.

Files live in media/uploads/ (mounted at MEDIA_DIR). Uploaded names are
reduced to a plain filename and checked against the allowed types, and
reads and deletes only touch files that are actually in the library.
"""

import os
import shutil
import time
from typing import Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from .. import state
from ..settings import MEDIA_DIR

router = APIRouter(prefix="/media", tags=["media"])

MEDIA_EXTENSIONS = {".gif", ".png", ".jpg", ".jpeg", ".webp", ".mp4", ".webm"}

os.makedirs(MEDIA_DIR, exist_ok=True)


class MediaUpdate(BaseModel):
    file: Optional[str] = None


def _safe_name(name: str) -> str:
    """A plain filename with an allowed extension, or raise 422."""
    name = os.path.basename((name or "").replace("\\", "/")).strip()
    if not name or name.startswith(".") or os.path.splitext(name)[1].lower() not in MEDIA_EXTENSIONS:
        raise HTTPException(status_code=422, detail="Use a GIF, PNG, JPG, WebP, MP4 or WebM file.")
    return name


def _library_path(name: str) -> str:
    """Path of a file that exists in the library, or raise 404."""
    path = os.path.join(MEDIA_DIR, os.path.basename(name))
    if os.path.basename(name) != name or not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="File not found")
    return path


@router.post("/upload")
def upload_media(file: UploadFile = File(...)):
    """Add a file to the library (a file with the same name is replaced)."""
    name = _safe_name(file.filename)
    tmp = os.path.join(MEDIA_DIR, f".uploading-{name}")
    with open(tmp, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    os.replace(tmp, os.path.join(MEDIA_DIR, name))
    return {"message": "Uploaded successfully", "filename": name}


@router.get("")
def list_media():
    """Every file in the library with its type, size (MB) and upload time."""
    files = []
    for name in sorted(os.listdir(MEDIA_DIR)):
        path = os.path.join(MEDIA_DIR, name)
        if name.startswith(".") or not os.path.isfile(path):
            continue
        st = os.stat(path)
        files.append({
            "filename": name,
            "type": os.path.splitext(name)[1].lstrip(".").upper(),
            "size": round(st.st_size / (1024 * 1024), 2),
            "uploaded": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(st.st_mtime)),
        })
    return {"files": files}


@router.get("/current")
def get_current_media():
    """The file the Media screen shows."""
    return state.current_media


@router.post("/current")
def set_current_media(data: MediaUpdate):
    """Choose the Media screen's file (null to show nothing)."""
    if data.file is not None:
        _library_path(data.file)
    state.current_media["file"] = data.file
    state.save()
    return state.current_media


@router.get("/{filename}")
def get_media(filename: str):
    return FileResponse(_library_path(filename))


@router.delete("/{filename}")
def delete_media(filename: str):
    os.remove(_library_path(filename))
    if state.current_media["file"] == filename:
        state.current_media["file"] = None
        state.save()
    return {"message": "Deleted", "filename": filename}
