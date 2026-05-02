"""
WAT (West Africa Time, UTC+1) timezone helpers.
Always use now_wat() instead of datetime.utcnow() or datetime.now() throughout the app.
"""
from datetime import datetime, timezone, timedelta

WAT = timezone(timedelta(hours=1))
WAT_TZ = WAT


def now_wat() -> datetime:
    """Return the current datetime in WAT (UTC+1)."""
    return datetime.now(WAT)


def to_wat(dt: datetime) -> datetime:
    """Convert any datetime to WAT.  Naive datetimes are assumed to be UTC."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(WAT)


def format_wat_iso(dt: datetime) -> str:
    """Return an ISO-8601 string with WAT offset (+01:00)."""
    if dt is None:
        return None
    return to_wat(dt).isoformat()
