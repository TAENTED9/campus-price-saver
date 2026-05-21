"""
Cloudinary media cleanup tasks.

Schema note: CloudinaryAsset uses `asset_type` (avatar/banner/listing_photo/…)
not `resource_type`. Cloudinary's destroy() API expects resource_type to be
one of {image, video, raw} — we infer 'image' as the default since every
asset_type in this codebase is an image.
"""

from app.celery_app import celery
from app.database import SessionLocal
from app.models import CloudinaryAsset
import cloudinary.uploader
import logging

logger = logging.getLogger(__name__)


# ── FIX #25 / Block 3 #15: Delete Cloudinary assets ──────────────────────
@celery.task(
    name="app.tasks.media_tasks.delete_cloudinary_assets",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    queue="media",
)
def delete_cloudinary_assets(self, asset_ids: list[int]):
    """
    Delete Cloudinary assets by DB record IDs.
    Called when a listing or user is deleted.
    Runs in background — does not block the response.
    """
    if not asset_ids:
        return

    db = SessionLocal()
    try:
        assets = (
            db.query(CloudinaryAsset)
            .filter(CloudinaryAsset.id.in_(asset_ids))
            .all()
        )

        for asset in assets:
            try:
                cloudinary.uploader.destroy(
                    asset.public_id,
                    resource_type="image",
                )
                db.delete(asset)
                logger.info(
                    f"Deleted Cloudinary asset: {asset.public_id}"
                )
            except Exception as e:
                logger.error(
                    f"Failed to delete {asset.public_id}: {e}"
                )

        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error(f"delete_cloudinary_assets error: {exc}")
        raise self.retry(exc=exc)
    finally:
        db.close()


@celery.task(
    name="app.tasks.media_tasks.delete_cloudinary_by_public_ids",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    queue="media",
)
def delete_cloudinary_by_public_ids(self, public_ids: list[str]):
    """
    Best-effort destroy by raw Cloudinary public_id (no DB record needed).
    Useful when a listing photo is replaced or removed before a DB row exists.
    """
    if not public_ids:
        return
    for pid in public_ids:
        try:
            cloudinary.uploader.destroy(pid, resource_type="image")
            logger.info(f"Deleted Cloudinary (by id): {pid}")
        except Exception as e:
            logger.error(f"Failed to delete {pid}: {e}")
