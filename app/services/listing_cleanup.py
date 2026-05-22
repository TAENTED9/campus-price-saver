"""
Shared FK-aware cleanup for deleting a Price (listing) row.

SQLite enforces FK constraints (PRAGMA foreign_keys=ON in database.py), and
several child tables reference prices.id with `NOT NULL` FKs, so SQLAlchemy's
default "set null on delete" cascade fails. This helper deletes every child
row in dependency order, then deletes the parent.

Both `/admin/listings/{id}` (admin moderation) and `/seller/listings/{id}`
(seller self-service) call this so the two paths can't drift.
"""

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models import Price


def purge_listing_children(db: Session, price_id: int) -> None:
    """Clear every row that references prices.id = :price_id.

    Caller must `db.delete(price)` and `db.commit()` afterward. We don't
    commit here so callers can bundle the parent delete + any audit log
    writes in a single transaction.
    """
    params = {"id": price_id}

    # Hard-delete child rows tied to this listing
    db.execute(text("DELETE FROM wishlists         WHERE listing_id = :id"),         params)
    db.execute(text("DELETE FROM inquiries         WHERE listing_id = :id"),         params)
    db.execute(text("DELETE FROM reviews           WHERE listing_id = :id"),         params)
    db.execute(text("DELETE FROM flash_sales       WHERE price_id   = :id"),         params)
    db.execute(text("DELETE FROM leads             WHERE listing_id = :id"),         params)
    db.execute(text("DELETE FROM cloudinary_assets WHERE listing_id = :id"),         params)
    db.execute(text("DELETE FROM orders            WHERE listing_id = :id"),         params)
    db.execute(text("DELETE FROM points_transactions WHERE related_price_id = :id"), params)

    # Disputes, notifications, conversations: preserve history by nulling the
    # listing pointer (these columns are nullable).
    db.execute(text("UPDATE disputes SET price_id = NULL WHERE price_id = :id"), params)
    db.execute(
        text(
            "UPDATE notifications SET related_id = NULL "
            "WHERE related_type IN ('Listing','listing','price','Price') AND related_id = :id"
        ),
        params,
    )
    db.execute(text("UPDATE conversations SET listing_id = NULL WHERE listing_id = :id"), params)

    # Reports: reports.target_id is NOT NULL, so we can't null it out. The row
    # only makes sense alongside the listing it points at, so hard-delete any
    # listing-typed report tied to this id.
    db.execute(
        text(
            "DELETE FROM reports "
            "WHERE target_type IN ('Listing','listing','price','Price') AND target_id = :id"
        ),
        params,
    )


def delete_listing_with_children(db: Session, listing: Price) -> None:
    """Convenience: purge children then delete the parent. Does not commit."""
    purge_listing_children(db, listing.id)
    db.delete(listing)
