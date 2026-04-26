"""Karma points service — Feature 4B.

Centralised place to award/deduct karma points. Writes to both
karma_ledger (new detailed log) and updates users.seller_points.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import KarmaLedger, User


_PROFILE_COMPLETE_REASON = "profile_complete"


def award_karma(
    seller_id: int,
    points: int,
    reason: str,
    db: Session,
    reference_id: str | None = None,
) -> int:
    """Insert a karma_ledger row, update seller_points, and return the new total.

    When reference_id is provided the operation is idempotent: a duplicate
    (seller_id, reason, reference_id) triple is silently skipped.
    """
    if reference_id is not None:
        exists = (
            db.query(KarmaLedger)
            .filter(
                KarmaLedger.seller_id == seller_id,
                KarmaLedger.reason == reason,
                KarmaLedger.reference_id == reference_id,
            )
            .first()
        )
        if exists:
            user = db.query(User).filter(User.id == seller_id).first()
            return (user.seller_points or 0) if user else 0

    entry = KarmaLedger(
        seller_id=seller_id,
        points=points,
        reason=reason,
        reference_id=reference_id,
    )
    db.add(entry)

    user = db.query(User).filter(User.id == seller_id).first()
    if user:
        user.seller_points = max(0, (user.seller_points or 0) + points)
        return user.seller_points
    return 0


def check_and_award_profile_complete(seller_id: int, db: Session) -> bool:
    """One-time +50 pts when a seller's profile is fully complete.

    Returns True if points were awarded, False if already awarded before.
    """
    already = (
        db.query(KarmaLedger)
        .filter(
            KarmaLedger.seller_id == seller_id,
            KarmaLedger.reason == _PROFILE_COMPLETE_REASON,
        )
        .first()
    )
    if already:
        return False

    user = db.query(User).filter(User.id == seller_id).first()
    if not user:
        return False

    complete = bool(
        (user.display_name or user.username)
        and user.bio
        and user.avatar_url
        and (user.department or user.level)
    )
    if not complete:
        return False

    award_karma(seller_id, 50, _PROFILE_COMPLETE_REASON, db)
    return True
