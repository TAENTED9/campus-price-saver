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

ALLOWED_CONTENT_TYPES = {
    "image/jpeg", "image/png", "image/webp", "image/jpg",
    "image/gif", "image/heic", "image/heif",
}
MAX_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

# Magic-byte signatures for allowed formats
_MAGIC = [
    (b"\xff\xd8\xff",            "JPEG"),
    (b"\x89PNG\r\n\x1a\n",      "PNG"),
    (b"RIFF",                    "WebP"),   # full check: bytes[8:12] == b"WEBP"
    (b"GIF87a",                  "GIF"),
    (b"GIF89a",                  "GIF"),
]


def _check_magic(data: bytes) -> bool:
    """Return True if the file bytes match a known image format signature."""
    for sig, fmt in _MAGIC:
        if data[:len(sig)] == sig:
            if fmt == "WebP":
                return len(data) >= 12 and data[8:12] == b"WEBP"
            return True
    # HEIC/HEIF container — ftyp box at offset 4
    if len(data) >= 12 and data[4:8] == b"ftyp":
        brand = data[8:12]
        if brand in (b"heic", b"heix", b"mif1", b"msf1", b"heis", b"hevc", b"hevx"):
            return True
    return False


async def _validate_file(file: UploadFile) -> bytes:
    # Read first, then sniff — many browsers send octet-stream / wrong mime for phone photos.
    data = await file.read()
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="Empty file. Please choose an image.")
    if len(data) > MAX_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"File too large ({len(data) // 1024 // 1024} MB). Max size is 10 MB.",
        )
    if not _check_magic(data):
        ct = file.content_type or "unknown"
        raise HTTPException(
            status_code=400,
            detail=(
                f"Could not recognise image format (content-type: {ct}). "
                "Use JPEG, PNG, WebP, GIF or HEIC."
            ),
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


# ── Banner slide constants ─────────────────────────────────────────────────────
BANNER_WIDTH  = 1280
BANNER_HEIGHT = 480


@router.post("/banner-slide")
async def upload_banner_slide(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upload a homepage hero banner slide image to Cloudinary.
    Image MUST be exactly 1280 × 480 pixels (JPEG / PNG / WebP, max 5 MB).
    """
    data = await _validate_file(file)

    # Dimension check using Pillow
    try:
        from PIL import Image as PILImage
        import io
        img = PILImage.open(io.BytesIO(data))
        w, h = img.size
        if w != BANNER_WIDTH or h != BANNER_HEIGHT:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Banner must be exactly {BANNER_WIDTH}×{BANNER_HEIGHT} px. "
                    f"Your image is {w}×{h} px."
                ),
            )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Could not read image dimensions. Use a valid JPEG, PNG or WebP file.",
        )

    from app.services.cloudinary_service import upload_file, save_asset_record
    import time
    ts = int(time.time())
    result = upload_file(
        data,
        user_id=current_user.id,
        folder_path="banners",
        public_id=f"banner_{ts}",
    )
    if not result:
        raise HTTPException(status_code=503, detail="File upload service unavailable.")
    try:
        save_asset_record(db, current_user.id, result, "banner_slide")
    except Exception as e:
        print(f"[uploads] Failed to save asset record: {e}")
    return {"success": True, "url": result["url"]}


@router.post("/banner")
async def upload_banner(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upload a seller storefront cover / banner photo to Cloudinary.
    Returns { url: "https://..." } — caller must PATCH /api/storefront/cover-photo to persist.
    """
    data = await _validate_file(file)
    from app.services.cloudinary_service import upload_file, save_asset_record
    import time
    ts = int(time.time())
    result = upload_file(
        data,
        user_id=current_user.id,
        folder_path="storefront/banner",
        public_id=f"banner_{ts}",
    )
    if not result:
        raise HTTPException(status_code=503, detail="File upload service unavailable.")
    try:
        save_asset_record(db, current_user.id, result, "banner")
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
