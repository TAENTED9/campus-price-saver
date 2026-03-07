"""
Cloudinary upload helpers.
Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env.
"""

import os

CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")

_configured = False


def _ensure_configured():
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
        print("⚠️  cloudinary package not installed. Run: pip install cloudinary")
        return False


def upload_file(file_bytes: bytes, filename: str, folder: str = "seller_docs") -> str | None:
    """
    Upload a file to Cloudinary.
    Returns the secure URL on success, None on failure.
    """
    if not _ensure_configured():
        print("[cloudinary] Not configured — skipping upload")
        return None
    try:
        import cloudinary.uploader
        result = cloudinary.uploader.upload(
            file_bytes,
            folder=folder,
            public_id=filename,
            resource_type="auto",
            overwrite=True,
        )
        return result.get("secure_url")
    except Exception as e:
        print(f"[cloudinary] Upload failed for {filename}: {e}")
        return None
