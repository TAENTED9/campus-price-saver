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
from datetime import datetime

CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY    = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")

_configured = False


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
        )
        _configured = True
        return True
    except ImportError:
        print("[cloudinary_service] cloudinary package not installed. Run: pip install cloudinary")
        return False


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
    """
    if not _ensure_configured():
        print(f"[cloudinary_service] Not configured — skipping upload for user {user_id}")
        return None

    full_folder = f"campify/users/{user_id}/{folder_path}"

    try:
        import cloudinary.uploader
        result = cloudinary.uploader.upload(
            file_bytes,
            folder=full_folder,
            public_id=public_id,
            resource_type=resource_type,
            overwrite=True,
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
        print(f"[cloudinary_service] Upload failed for user {user_id} / {folder_path}: {e}")
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
        print(f"[cloudinary_service] Delete failed for {public_id}: {e}")
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
    asset_type: "avatar" | "banner" | "id_card" | "portal_screenshot" | "listing_photo"
    """
    from app.models import CloudinaryAsset
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
