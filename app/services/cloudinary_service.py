"""
Cloudinary service — enhanced upload with user-scoped folder paths.
Every upload is tracked in the cloudinary_assets table.

Folder conventions:
  campify/users/{user_id}/avatar
  campify/users/{user_id}/banner
  campify/users/{user_id}/verification/id_card
  campify/users/{user_id}/verification/portal_screenshot
  campify/users/{user_id}/listings/{listing_id}/photo_{index}

Requires env vars: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
"""

import os
import logging
from datetime import datetime

import requests.exceptions
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

logger = logging.getLogger("campify")

CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY    = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")

_configured = False

_UPLOAD_TIMEOUT = 30  # seconds — applied to both connect and read


def _ensure_configured() -> bool:
    global _configured
    if _configured:
        return True
    if not all([CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET]):
        return False
    try:
        import cloudinary
        cloudinary.config(
            cloud_name=CLOUDINARY_CLOUD_NAME,
            api_key=CLOUDINARY_API_KEY,
            api_secret=CLOUDINARY_API_SECRET,
            secure=True,
            timeout=_UPLOAD_TIMEOUT,
            chunk_size=6_000_000,
        )
        _configured = True
        return True
    except ImportError:
        logger.warning("[cloudinary_service] cloudinary package not installed. Run: pip install cloudinary")
        return False


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=8),
    retry=retry_if_exception_type((
        requests.exceptions.Timeout,
        requests.exceptions.SSLError,
        requests.exceptions.ConnectionError,
    )),
    reraise=True,
)
def _upload_with_retry(file_bytes: bytes, **kwargs) -> dict:
    import cloudinary.uploader
    return cloudinary.uploader.upload(file_bytes, **kwargs)


def upload_file(
    file_bytes: bytes,
    user_id: int,
    folder_path: str,          # e.g. "verification/id_card", "avatar", "listings/42/photo_0"
    public_id: str | None = None,
    resource_type: str = "image",
) -> dict | None:
    """
    Upload bytes to Cloudinary under campify/users/{user_id}/{folder_path}.
    Returns a dict with url, public_id, folder, asset_id, bytes, format.
    Returns None if Cloudinary is not configured or upload fails.
    Retries up to 3× on SSL / timeout errors with exponential back-off.
    """
    if not _ensure_configured():
        logger.warning(f"[cloudinary_service] Not configured — skipping upload for user {user_id}")
        return None

    full_folder = f"campify/users/{user_id}/{folder_path}"

    try:
        result = _upload_with_retry(
            file_bytes,
            folder=full_folder,
            public_id=public_id,
            resource_type=resource_type,
            overwrite=True,
            timeout=_UPLOAD_TIMEOUT,
            transformation=[
                {"fetch_format": "auto", "quality": "auto"}
            ],
            context={
                "user_id": str(user_id),
                "uploaded_at": datetime.utcnow().isoformat(),
            },
        )
        return {
            "url":        result["secure_url"],
            "public_id":  result["public_id"],
            "folder":     full_folder,
            "asset_id":   result.get("asset_id", ""),
            "bytes":      result.get("bytes"),
            "format":     result.get("format"),
        }
    except Exception as e:
        logger.error(f"[cloudinary_service] Upload failed for user {user_id} / {folder_path}: {e}")
        return None


def delete_asset(public_id: str, resource_type: str = "image") -> bool:
    """
    Delete a Cloudinary asset by public_id.
    Returns True on success, False on failure.
    """
    if not _ensure_configured():
        return False
    try:
        import cloudinary.uploader
        result = cloudinary.uploader.destroy(public_id, resource_type=resource_type)
        return result.get("result") == "ok"
    except Exception as e:
        logger.error(f"[cloudinary_service] Delete failed for {public_id}: {e}")
        return False


def save_asset_record(
    db,
    user_id: int,
    upload_result: dict,
    asset_type: str,
    listing_id: int | None = None,
):
    """
    Persist a CloudinaryAsset row after a successful upload.
    Uses UPSERT logic (update on duplicate public_id) so re-uploads never
    raise a UNIQUE constraint violation.
    asset_type: "avatar" | "banner" | "id_card" | "portal_screenshot" | "listing_photo"
    """
    from app.models import CloudinaryAsset

    existing = (
        db.query(CloudinaryAsset)
        .filter(CloudinaryAsset.public_id == upload_result["public_id"])
        .first()
    )

    if existing:
        existing.url        = upload_result["url"]
        existing.folder     = upload_result["folder"]
        existing.bytes      = upload_result.get("bytes")
        existing.format     = upload_result.get("format")
        existing.uploaded_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing

    asset = CloudinaryAsset(
        user_id=user_id,
        public_id=upload_result["public_id"],
        url=upload_result["url"],
        folder=upload_result["folder"],
        asset_type=asset_type,
        bytes=upload_result.get("bytes"),
        format=upload_result.get("format"),
        listing_id=listing_id,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset
