"""
File upload endpoints — Cloudinary-backed.
Requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env.
"""
import logging

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.routers.auth import get_current_user
from app.models import User
from app.limiter import limiter

logger = logging.getLogger("campify")

router = APIRouter(prefix="/upload", tags=["uploads"])

ALLOWED_CONTENT_TYPES = {
    "image/jpeg", "image/png", "image/webp", "image/jpg",
    "image/gif", "image/heic", "image/heif",
}
MAX_SIZE_BYTES = 10 * 1024 * 1024            # 10 MB — general uploads
MAX_VERIFICATION_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB — verification docs (ID card, portal screenshot)

# ── Video upload constants ────────────────────────────────────────────────────
# Block 5 decision: 50 MB / video, no hard duration window. Per-listing cap of 2
# is enforced inside the listing create/update endpoints, since this upload
# route doesn't know which listing the video is for.
MAX_VIDEO_SIZE_BYTES   = 50 * 1024 * 1024    # 50 MB per upload
MAX_VIDEOS_PER_LISTING = 2                   # enforced in seller.py create/update

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


def _check_video_magic(data: bytes) -> bool:
    """Return True if bytes match an accepted video container signature."""
    if len(data) < 12:
        return False
    # MP4 / MOV / M4V — ISO Base Media File Format. 'ftyp' box at offset 4.
    if data[4:8] == b"ftyp":
        brand = data[8:12]
        if brand in (
            b"isom", b"iso2", b"mp41", b"mp42", b"avc1",
            b"qt  ", b"M4V ", b"M4VP", b"M4VH",
        ):
            return True
    # WebM / Matroska — EBML header
    if data[:4] == b"\x1a\x45\xdf\xa3":
        return True
    return False


async def _validate_file(file: UploadFile, max_bytes: int = MAX_SIZE_BYTES) -> bytes:
    # Read first, then sniff — many browsers send octet-stream / wrong mime for phone photos.
    data = await file.read()
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="Empty file. Please choose an image.")
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"File too large ({len(data) // 1024 // 1024} MB). Max size is {max_bytes // 1024 // 1024} MB.",
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
@limiter.limit("10/hour")
async def upload_seller_id(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upload a seller's student ID card photo to Cloudinary.
    Stored as a PRIVATE asset (authenticated delivery) — only admin
    endpoints can render a signed URL for viewing.
    """
    data = await _validate_file(file, max_bytes=MAX_VERIFICATION_SIZE_BYTES)
    from app.services.cloudinary_service import upload_file, save_asset_record
    result = upload_file(
        data,
        user_id=current_user.id,
        folder_path="verification/id_card",
        public_id="id_card",
        is_sensitive=True,
    )
    if not result:
        raise HTTPException(
            status_code=503,
            detail="File upload service is unavailable. Please try again later.",
        )
    try:
        save_asset_record(db, current_user.id, result, "id_card")
    except Exception as e:
        logger.error(f"[uploads] Failed to save asset record: type=id_card user_id={current_user.id}")
    return {"success": True, "url": result["url"]}


@router.post("/seller-portal")
@limiter.limit("10/hour")
async def upload_portal_screenshot(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upload a seller's student portal screenshot to Cloudinary.
    Stored as a PRIVATE asset (authenticated delivery) — only admin
    endpoints can render a signed URL for viewing.
    """
    data = await _validate_file(file, max_bytes=MAX_VERIFICATION_SIZE_BYTES)
    from app.services.cloudinary_service import upload_file, save_asset_record
    result = upload_file(
        data,
        user_id=current_user.id,
        folder_path="verification/portal_screenshot",
        public_id="portal_screenshot",
        is_sensitive=True,
    )
    if not result:
        raise HTTPException(
            status_code=503,
            detail="File upload service is unavailable. Please try again later.",
        )
    try:
        save_asset_record(db, current_user.id, result, "portal_screenshot")
    except Exception as e:
        logger.error(f"[uploads] Failed to save asset record: type=portal_screenshot user_id={current_user.id}")
    return {"success": True, "url": result["url"]}


@router.post("/listing-photo")
@limiter.limit("60/hour")
async def upload_listing_photo(
    request: Request,
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
        logger.error(f"[uploads] Failed to save asset record: type=listing_photo user_id={current_user.id}")
    return {"success": True, "url": result["url"]}


# ── Banner slide constants ─────────────────────────────────────────────────────
# Recommended hero-banner size. The slide is ~2.3:1 and only 2/3 of the page
# width, so a wide image looks best. We accept anything that meets the minimum
# resolution and is landscape — object-cover crops to fit — instead of demanding
# an exact size (which broke whenever the homepage layout width changed).
BANNER_WIDTH      = 1600   # recommended
BANNER_HEIGHT     = 700
BANNER_MIN_WIDTH  = 1000
BANNER_MIN_HEIGHT = 440
BANNER_MIN_RATIO  = 1.8    # must be a wide landscape image


@router.post("/banner-slide")
@limiter.limit("20/hour")
async def upload_banner_slide(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upload a homepage hero banner slide image to Cloudinary.

    Accepts any wide landscape image at least {BANNER_MIN_WIDTH}×{BANNER_MIN_HEIGHT}
    px (JPEG / PNG / WebP, max 5 MB). ~{BANNER_WIDTH}×{BANNER_HEIGHT} px is ideal;
    the hero renders it with object-cover, cropping the edges to fit.
    """
    data = await _validate_file(file)

    # Dimension check using Pillow — minimum resolution + landscape aspect.
    try:
        from PIL import Image as PILImage
        import io
        img = PILImage.open(io.BytesIO(data))
        w, h = img.size
        if w < BANNER_MIN_WIDTH or h < BANNER_MIN_HEIGHT:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Banner is too small ({w}×{h} px). Use at least "
                    f"{BANNER_MIN_WIDTH}×{BANNER_MIN_HEIGHT} px "
                    f"(~{BANNER_WIDTH}×{BANNER_HEIGHT} recommended)."
                ),
            )
        if h == 0 or (w / h) < BANNER_MIN_RATIO:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Banner must be a wide landscape image "
                    f"(about {BANNER_WIDTH}×{BANNER_HEIGHT}). Yours is {w}×{h} px."
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
        logger.error(f"[uploads] Failed to save asset record: type=banner_slide user_id={current_user.id}")
    return {"success": True, "url": result["url"]}


@router.post("/banner")
@limiter.limit("20/hour")
async def upload_banner(
    request: Request,
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
        logger.error(f"[uploads] Failed to save asset record: type=banner user_id={current_user.id}")
    return {"success": True, "url": result["url"]}


@router.post("/review-image")
@limiter.limit("20/hour")
async def upload_review_image(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upload a review photo to Cloudinary.
    Returns { url: "https://..." } — caller includes the URL in the review payload.
    """
    from app.services.cloudinary_service import upload_file, save_asset_record
    import time
    data = await _validate_file(file)
    ts = int(time.time())
    result = upload_file(
        data,
        user_id=current_user.id,
        folder_path="reviews",
        public_id=f"review_{current_user.id}_{ts}",
    )
    if not result:
        raise HTTPException(status_code=503, detail="File upload service unavailable.")
    try:
        save_asset_record(db, current_user.id, result, "review_image")
    except Exception as e:
        logger.error(f"[uploads] Failed to save asset record: type=review_image user_id={current_user.id}")
    return {"success": True, "url": result["url"]}


@router.get("/listing-video/quota")
async def listing_video_quota(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return the per-listing video constraints.

    Block 5 (post-update): caps are now per-listing (max 2), enforced in the
    listing create/update endpoints — NOT account-wide. This endpoint is kept
    so older frontend clients don't 404; it returns the new shape with
    `per_listing_max` so the uploader UI can hint the user before submitting.
    """
    _ = current_user  # auth gate only; no per-user state is read
    _ = db
    return {
        "success": True,
        "per_listing_max": MAX_VIDEOS_PER_LISTING,
        "max_size_mb": MAX_VIDEO_SIZE_BYTES // (1024 * 1024),
        # Legacy fields kept null so old clients don't crash on missing keys.
        "used": None,
        "max": None,
        "remaining": None,
        "min_duration_sec": None,
        "max_duration_sec": None,
    }


@router.post("/listing-video")
@limiter.limit("10/hour")
async def upload_listing_video(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upload a product video to Cloudinary.

    Limits:
      - Size: up to 50 MB; mp4 / mov / webm only.
      - Per-listing cap (max 2) is enforced when the listing create/update
        endpoint receives the videos array — NOT here, since this route has
        no listing context.
    """
    data = await file.read()
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="Empty file. Please choose a video.")
    if len(data) > MAX_VIDEO_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"Video too large ({len(data) // 1024 // 1024} MB). Max size is {MAX_VIDEO_SIZE_BYTES // 1024 // 1024} MB.",
        )
    if not _check_video_magic(data):
        raise HTTPException(
            status_code=400,
            detail="Unsupported video format. Use MP4, MOV or WebM.",
        )

    from app.services.cloudinary_service import upload_file, save_asset_record
    import time
    ts = int(time.time())
    result = upload_file(
        data,
        user_id=current_user.id,
        folder_path="listings/videos",
        public_id=f"video_{ts}",
        resource_type="video",
    )
    if not result:
        raise HTTPException(status_code=503, detail="Video upload service unavailable.")

    try:
        save_asset_record(db, current_user.id, result, "listing_video")
    except Exception:
        logger.error(f"[uploads] Failed to save asset record: type=listing_video user_id={current_user.id}")

    return {
        "success": True,
        "url": result["url"],
    }


@router.delete("/listing-video")
@limiter.limit("30/hour")
async def delete_listing_video(
    request: Request,
    url: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Delete one of the seller's previously-uploaded videos by URL.
    Frees a quota slot so the user can upload a replacement.
    """
    from app.models import CloudinaryAsset
    asset = (
        db.query(CloudinaryAsset)
        .filter(
            CloudinaryAsset.user_id == current_user.id,
            CloudinaryAsset.asset_type == "listing_video",
            CloudinaryAsset.url == url,
        )
        .first()
    )
    if not asset:
        raise HTTPException(status_code=404, detail="Video not found.")

    from app.services.cloudinary_service import delete_asset
    delete_asset(asset.public_id, resource_type="video")
    db.delete(asset)
    db.commit()
    return {"success": True}


@router.post("/avatar")
@limiter.limit("20/hour")
async def upload_avatar(
    request: Request,
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
        logger.error(f"[uploads] Failed to save asset record: type=avatar user_id={current_user.id}")
    return {"success": True, "url": result["url"]}
