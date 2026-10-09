import json
import uuid
from pathlib import Path

from config import settings

# Keyed by the content-types routers/reports.py validates against — the extension is
# derived from this, never from the caller-supplied filename, so a mismatched or
# malicious extension (e.g. "photo.svg" on an image/jpeg upload) can't end up stored.
_EXTENSION_BY_CONTENT_TYPE = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


class StorageService:
    """Upload report photos to Supabase Storage or local fallback."""

    def __init__(self) -> None:
        self._client = None
        if settings.supabase_url and settings.supabase_service_key:
            try:
                from supabase import create_client

                self._client = create_client(settings.supabase_url, settings.supabase_service_key)
            except Exception:
                self._client = None

        self._local_dir = Path("./uploads/reports")
        self._local_dir.mkdir(parents=True, exist_ok=True)

    def upload_report_photo(self, filename: str, content: bytes, content_type: str) -> str:
        ext = _EXTENSION_BY_CONTENT_TYPE.get(content_type, Path(filename).suffix or ".jpg")
        object_name = f"{uuid.uuid4().hex}{ext}"

        if self._client:
            bucket = "report-photos"
            self._client.storage.from_(bucket).upload(
                object_name,
                content,
                file_options={"content-type": content_type},
            )
            return self._client.storage.from_(bucket).get_public_url(object_name)

        local_path = self._local_dir / object_name
        local_path.write_bytes(content)
        return f"/uploads/reports/{object_name}"
