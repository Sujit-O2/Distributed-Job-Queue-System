import os
import re
import shutil
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_UPLOAD_ROOT = PROJECT_ROOT / "uploads"


def get_upload_root():
    upload_root = Path(os.getenv("UPLOAD_ROOT", DEFAULT_UPLOAD_ROOT))
    upload_root.mkdir(parents=True, exist_ok=True)
    return upload_root


def _sanitize_filename(filename: str | None):
    original_name = Path(filename or "upload.bin").name
    safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", original_name).strip("._")
    return safe_name or "upload.bin"


def store_upload_file(uploaded_file: UploadFile):
    upload_root = get_upload_root()
    safe_name = _sanitize_filename(uploaded_file.filename)
    target_path = upload_root / f"{uuid4().hex}_{safe_name}"

    with target_path.open("wb") as destination:
        shutil.copyfileobj(uploaded_file.file, destination)

    return {
        "original_name": uploaded_file.filename or safe_name,
        "stored_name": target_path.name,
        "path": str(target_path.resolve()),
        "size": target_path.stat().st_size,
    }
