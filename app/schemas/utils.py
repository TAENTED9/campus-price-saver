"""
app/schemas/utils.py — Serialization & timezone helpers (Block 7).

Use serialize_dt() on every datetime before including it in a response dict
so callers always receive an ISO-8601 string with explicit UTC offset.
"""
from datetime import datetime, timezone


def serialize_dt(dt: datetime | None) -> str | None:
    """
    Return an ISO-8601 string with UTC offset, or None.
    Naive datetimes (no tzinfo) are assumed UTC and tagged accordingly.
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def is_flash_sale_active(flash_sale) -> bool:
    """
    Return True if the flash sale's end_time is in the future.
    Handles naive end_time by assuming UTC.
    """
    now = datetime.now(timezone.utc)
    ends = getattr(flash_sale, "end_time", None)
    if ends is None:
        return False
    if ends.tzinfo is None:
        ends = ends.replace(tzinfo=timezone.utc)
    return ends > now
