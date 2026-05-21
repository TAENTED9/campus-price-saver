"""
Notification tasks queue.

Most notification rows are written synchronously via BackgroundTasks
(fast DB writes — see Block 4 of the migration plan). This module exists
so the Celery worker autodiscovers the `notifications` queue and so we
have a place to push notification work that fans out (e.g. per-follower
new-listing alerts) where the per-recipient cost adds up.
"""

from app.celery_app import celery
from app.database import SessionLocal
from app.models import Notification
import logging

logger = logging.getLogger(__name__)


# ── Price-drop fan-out (flash sale created) ───────────────────────────────
@celery.task(
    name="app.tasks.notification_tasks.notify_price_drop_for_listing",
    queue="notifications",
)
def notify_price_drop_for_listing(
    listing_id: int,
    listing_title: str,
    original_price: float,
    sale_price: float,
):
    """
    Fan out in-app price-drop notifications to every user who wishlisted
    this listing. Called when a seller creates a flash sale.
    """
    from app.models import Wishlist

    db = SessionLocal()
    try:
        wishlisters = db.query(Wishlist).filter(
            Wishlist.listing_id == listing_id,
        ).all()

        if not wishlisters:
            return

        if original_price and original_price > 0:
            drop_pct = int((1 - sale_price / original_price) * 100)
        else:
            drop_pct = 0

        rows = [
            Notification(
                user_id=w.user_id,
                type="price_drop",
                title=f"{drop_pct}% off!" if drop_pct > 0 else "Price drop!",
                body=(
                    f"{listing_title} dropped from "
                    f"₦{original_price:,.0f} to ₦{sale_price:,.0f}"
                ),
                action_url="/dashboard/wishlist",
                related_id=listing_id,
                related_type="Listing",
                is_read=False,
            )
            for w in wishlisters
        ]
        db.bulk_save_objects(rows)
        db.commit()
        logger.info(
            f"notify_price_drop_for_listing: notified {len(rows)} wishlisters "
            f"for listing {listing_id}"
        )
    except Exception as e:
        db.rollback()
        logger.error(f"notify_price_drop_for_listing error: {e}")
    finally:
        db.close()


# ── Order status change ───────────────────────────────────────────────────
@celery.task(
    name="app.tasks.notification_tasks.notify_order_status_change",
    queue="notifications",
)
def notify_order_status_change(
    buyer_id: int,
    order_uuid: str,
    listing_title: str,
    new_status: str,
):
    status_copy = {
        "met_up": (
            "Meetup confirmed",
            f"Your meetup for {listing_title} has been confirmed.",
        ),
        "completed": (
            "Order complete!",
            f"Your order for {listing_title} is complete. Leave a review?",
        ),
        "cancelled": (
            "Order cancelled",
            f"Your order for {listing_title} was cancelled by the seller.",
        ),
    }
    if new_status not in status_copy:
        return

    title, body = status_copy[new_status]
    db = SessionLocal()
    try:
        db.add(Notification(
            user_id=buyer_id,
            type=f"order_{new_status}",
            title=title,
            body=body,
            action_url=f"/dashboard/orders/{order_uuid}",
            is_read=False,
        ))
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"notify_order_status_change error: {e}")
    finally:
        db.close()


# ── New review received ───────────────────────────────────────────────────
@celery.task(
    name="app.tasks.notification_tasks.notify_review_received",
    queue="notifications",
)
def notify_review_received(
    seller_id: int,
    reviewer_name: str,
    rating: int,
    listing_uuid: str,
):
    db = SessionLocal()
    try:
        db.add(Notification(
            user_id=seller_id,
            type="new_review",
            title=f"New {rating}-star review",
            body=f"{reviewer_name} left you a {rating}-star review",
            action_url="/seller/listings",
            is_read=False,
        ))
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"notify_review_received error: {e}")
    finally:
        db.close()


@celery.task(
    name="app.tasks.notification_tasks.create_notification",
    queue="notifications",
)
def create_notification(
    user_id: int,
    type: str,
    title: str,
    body: str,
    action_url: str | None = None,
):
    """Asynchronously insert a single Notification row."""
    db = SessionLocal()
    try:
        n = Notification(
            user_id=user_id,
            type=type,
            title=title,
            body=body,
            action_url=action_url,
            is_read=False,
        )
        db.add(n)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"create_notification error: {e}")
    finally:
        db.close()


@celery.task(
    name="app.tasks.notification_tasks.fanout_new_listing",
    queue="notifications",
)
def fanout_new_listing(
    seller_id: int,
    listing_id: int,
    listing_title: str,
):
    """
    Notify every follower of `seller_id` about a new listing.
    Bulk insert of Notification rows runs off the request path.
    """
    from app.models import Follow

    db = SessionLocal()
    try:
        follower_ids = [
            row[0] for row in
            db.query(Follow.follower_id)
            .filter(Follow.seller_id == seller_id)
            .all()
        ]
        if not follower_ids:
            return

        rows = [
            Notification(
                user_id=fid,
                type="new_listing",
                title="New listing from a seller you follow",
                body=listing_title,
                action_url=f"/listing/{listing_id}",
                is_read=False,
            )
            for fid in follower_ids
        ]
        db.bulk_save_objects(rows)
        db.commit()
        logger.info(
            f"fanout_new_listing: notified {len(follower_ids)} followers"
        )
    except Exception as e:
        db.rollback()
        logger.error(f"fanout_new_listing error: {e}")
    finally:
        db.close()
