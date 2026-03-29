"""
File upload endpoints — Cloudinary-backed.
Requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env.
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.routers.auth import get_current_user
from app.models import User

router = APIRouter(prefix="/upload", tags=["uploads"])

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/jpg"}
MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB

# Magic-byte signatures for allowed formats
_MAGIC = [
    (b"\xff\xd8\xff",            "JPEG"),
    (b"\x89PNG\r\n\x1a\n",      "PNG"),
    (b"RIFF",                    "WebP"),  # full check: bytes[8:12] == b"WEBP"
]


def _check_magic(data: bytes) -> bool:
    """Return True if the file bytes match a known image format signature."""
    for sig, fmt in _MAGIC:
        if data[:len(sig)] == sig:
            if fmt == "WebP":
                return len(data) >= 12 and data[8:12] == b"WEBP"
            return True
    return False


async def _validate_file(file: UploadFile) -> bytes:
    # Content-Type header check (first, cheap)
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Use JPEG, PNG or WebP.",
        )
    data = await file.read()
    if len(data) > MAX_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="File too large. Max size is 5 MB.")
    # Magic-bytes check — prevents spoofed Content-Type headers
    if not _check_magic(data):
        raise HTTPException(
            status_code=400,
            detail="File content does not match a valid image format.",
        )
    return data


@router.post("/seller-id")
async def upload_seller_id(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upload a seller's student ID card photo to Cloudinary.
    Returns { url: "https://..." } on success.
    """
    data = await _validate_file(file)
    from app.services.cloudinary_service import upload_file, save_asset_record
    result = upload_file(data, user_id=current_user.id, folder_path="verification/id_card", public_id="id_card")
    if not result:
        raise HTTPException(
            status_code=503,
            detail="File upload service is unavailable. Please try again later.",
        )
    try:
        save_asset_record(db, current_user.id, result, "id_card")
    except Exception as e:
        print(f"[uploads] Failed to save asset record: {e}")
    return {"success": True, "url": result["url"]}


@router.post("/seller-portal")
async def upload_portal_screenshot(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upload a seller's student portal screenshot to Cloudinary.
    Returns { url: "https://..." } on success.
    """
    data = await _validate_file(file)
    from app.services.cloudinary_service import upload_file, save_asset_record
    result = upload_file(data, user_id=current_user.id, folder_path="verification/portal_screenshot", public_id="portal_screenshot")
    if not result:
        raise HTTPException(
            status_code=503,
            detail="File upload service is unavailable. Please try again later.",
        )
    try:
        save_asset_record(db, current_user.id, result, "portal_screenshot")
    except Exception as e:
        print(f"[uploads] Failed to save asset record: {e}")
    return {"success": True, "url": result["url"]}


@router.post("/listing-photo")
async def upload_listing_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upload a product listing photo to Cloudinary.
    Returns { url: "https://..." } on success. Call up to 5 times per listing.
    """
    data = await _validate_file(file)
    from app.services.cloudinary_service import upload_file, save_asset_record
    import time
    ts = int(time.time())
    result = upload_file(data, user_id=current_user.id, folder_path=f"listings/temp", public_id=f"photo_{ts}")
    if not result:
        raise HTTPException(status_code=503, detail="File upload service unavailable.")
    try:
        save_asset_record(db, current_user.id, result, "listing_photo")
    except Exception as e:
        print(f"[uploads] Failed to save asset record: {e}")
    return {"success": True, "url": result["url"]}


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upload a user's profile photo to Cloudinary.
    Returns { url: "https://..." } — caller must PATCH /api/auth/me to persist the URL.
    """
    from app.services.cloudinary_service import upload_file, save_asset_record
    data = await _validate_file(file)
    result = upload_file(data, user_id=current_user.id, folder_path="avatar", public_id="avatar")
    if not result:
        raise HTTPException(status_code=503, detail="File upload service unavailable.")
    try:
        save_asset_record(db, current_user.id, result, "avatar")
    except Exception as e:
        print(f"[uploads] Failed to save asset record: {e}")
    return {"success": True, "url": result["url"]}
