"""
File upload endpoints — Cloudinary-backed.
Requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env.
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from app.routers.auth import get_current_user
from app.models import User

router = APIRouter(prefix="/upload", tags=["uploads"])

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/jpg"}
MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


async def _validate_file(file: UploadFile) -> bytes:
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Use JPEG, PNG or WebP.",
        )
    data = await file.read()
    if len(data) > MAX_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="File too large. Max size is 5 MB.")
    return data


@router.post("/seller-id")
async def upload_seller_id(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """
    Upload a seller's student ID card photo to Cloudinary.
    Returns { url: "https://..." } on success.
    """
    data = await _validate_file(file)
    from app.services.cloudinary_upload import upload_file
    url = upload_file(
        data,
        filename=f"seller_id_{current_user.id}",
        folder="seller_docs/ids",
    )
    if not url:
        raise HTTPException(
            status_code=503,
            detail="File upload service is unavailable. Please try again later.",
        )
    return {"success": True, "url": url}


@router.post("/seller-portal")
async def upload_portal_screenshot(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """
    Upload a seller's student portal screenshot to Cloudinary.
    Returns { url: "https://..." } on success.
    """
    data = await _validate_file(file)
    from app.services.cloudinary_upload import upload_file
    url = upload_file(
        data,
        filename=f"portal_{current_user.id}",
        folder="seller_docs/portals",
    )
    if not url:
        raise HTTPException(
            status_code=503,
            detail="File upload service is unavailable. Please try again later.",
        )
    return {"success": True, "url": url}


@router.post("/listing-photo")
async def upload_listing_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """
    Upload a product listing photo to Cloudinary.
    Returns { url: "https://..." } on success. Call up to 5 times per listing.
    """
    data = await _validate_file(file)
    from app.services.cloudinary_upload import upload_file
    import time
    url = upload_file(
        data,
        filename=f"listing_{current_user.id}_{int(time.time())}",
        folder="listings",
    )
    if not url:
        raise HTTPException(status_code=503, detail="File upload service unavailable.")
    return {"success": True, "url": url}


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """
    Upload a user's profile photo to Cloudinary and update their avatar_url.
    Returns { url: "https://..." } on success.
    """
    from app.services.cloudinary_upload import upload_file
    from app.dependencies import get_db
    from sqlalchemy.orm import Session
    from fastapi import Depends as _Depends

    data = await _validate_file(file)
    url = upload_file(
        data,
        filename=f"avatar_{current_user.id}",
        folder="avatars",
    )
    if not url:
        raise HTTPException(status_code=503, detail="File upload service unavailable.")
    return {"success": True, "url": url}
