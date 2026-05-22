"""
Price-alert notification fan-out.

When a listing becomes visible to buyers (status → 'approved') we look for any
active PriceAlert rows whose `item_name` keyword appears in the listing name
and whose `target_price` is at or above the listing price. Each match gets a
Notification row (in-app bell) and the alert's trigger_count is bumped.

Called from the admin approval handler so unapproved/pending listings never
fire alerts.
"""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import func

if TYPE_CHECKING:
    from sqlalchemy.orm import Session
    from app.models import Price


def notify_matching_price_alerts(db: "Session", listing: "Price") -> int:
    """Fire notifications for every active alert that matches this listing.

    Match rules:
      - alert.is_active = True
      - alert.user_id != listing.submitted_by (don't ping the seller about their own listing)
      - alert.item_name appears (case-insensitive substring) in listing.name
      - if alert.category_id is set, it must match listing.category_id
      - if alert.target_price is set, listing.price must be <= target_price

    Returns the number of alerts that fired (for logging/tests).
    """
    from app.models import PriceAlert, Notification

    if not listing or not listing.name:
        return 0

    name_lc = listing.name.lower()
    q = db.query(PriceAlert).filter(PriceAlert.is_active == True)  # noqa: E712
    if listing.submitted_by is not None:
        q = q.filter(PriceAlert.user_id != listing.submitted_by)
    # category narrows results when set; alerts without a category still match
    q = q.filter(
        (PriceAlert.category_id == None)  # noqa: E711
        | (PriceAlert.category_id == listing.category_id)
    )

    candidates = q.all()
    fired = 0
    now = datetime.utcnow()

    for alert in candidates:
        keyword = (alert.item_name or "").strip().lower()
        if not keyword or keyword not in name_lc:
            continue
        if alert.target_price is not None and listing.price > alert.target_price:
            continue

        db.add(Notification(
            user_id=alert.user_id,
            type="price_alert_match",
            title=f'Price alert: "{alert.item_name}"',
            body=(
                f'A matching listing "{listing.name}" is now live at '
                f'₦{listing.price:,.0f}'
                + (f' (under your ₦{alert.target_price:,.0f} target).'
                   if alert.target_price is not None else '.')
            ),
            related_id=listing.id,
            related_type="Listing",
            is_read=False,
            action_url=f"/listing/{listing.id}",
        ))
        alert.last_triggered_at = now
        alert.trigger_count = (alert.trigger_count or 0) + 1
        fired += 1

    return fired
