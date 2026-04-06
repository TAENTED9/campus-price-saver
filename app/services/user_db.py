"""
Block 4A — Per-user isolated data tables.

Every user gets 4 tables created at registration:
  user_{id}_profile    — profile key/value pairs
  user_{id}_settings   — preferences / toggles
  user_{id}_activity   — immutable event log
  user_{id}_notif_prefs — notification preferences

All functions are safe to call on missing tables (returns {} / no-op).
"""

import json
from sqlalchemy import text


def create_user_tables(user_id: int, db_engine) -> None:
    """
    Called once when a user registers.
    Creates 4 tables prefixed with the user's ID (idempotent).
    """
    with db_engine.connect() as conn:
        # 1. Profile
        conn.execute(text(f"""
            CREATE TABLE IF NOT EXISTS user_{user_id}_profile (
                key        TEXT PRIMARY KEY,
                value      TEXT,
                updated_at TEXT DEFAULT (datetime('now'))
            )
        """))
        # 2. Settings
        conn.execute(text(f"""
            CREATE TABLE IF NOT EXISTS user_{user_id}_settings (
                key        TEXT PRIMARY KEY,
                value      TEXT,
                updated_at TEXT DEFAULT (datetime('now'))
            )
        """))
        # 3. Activity log
        conn.execute(text(f"""
            CREATE TABLE IF NOT EXISTS user_{user_id}_activity (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                action     TEXT NOT NULL,
                details    TEXT,
                ip_address TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """))
        # 4. Notification preferences
        conn.execute(text(f"""
            CREATE TABLE IF NOT EXISTS user_{user_id}_notif_prefs (
                key        TEXT PRIMARY KEY,
                value      TEXT,
                updated_at TEXT DEFAULT (datetime('now'))
            )
        """))
        conn.commit()


def drop_user_tables(user_id: int, db_engine) -> None:
    """
    Called when admin hard-deletes a user.
    Drops all 4 per-user tables completely (total data wipe).
    """
    with db_engine.connect() as conn:
        for suffix in ("profile", "settings", "activity", "notif_prefs"):
            conn.execute(text(f"DROP TABLE IF EXISTS user_{user_id}_{suffix}"))
        conn.commit()


def upsert_user_data(
    user_id: int,
    table_suffix: str,   # "profile" | "settings" | "notif_prefs"
    data: dict,
    db_engine,
) -> None:
    """
    Upserts multiple key-value pairs into a user's table.
    Silently no-ops if the table doesn't exist yet.
    """
    if not data:
        return
    try:
        with db_engine.connect() as conn:
            for key, value in data.items():
                if value is None:
                    continue
                conn.execute(text(f"""
                    INSERT INTO user_{user_id}_{table_suffix} (key, value, updated_at)
                    VALUES (:key, :value, datetime('now'))
                    ON CONFLICT(key) DO UPDATE SET
                        value      = excluded.value,
                        updated_at = excluded.updated_at
                """), {"key": key, "value": str(value)})
            conn.commit()
    except Exception as e:
        print(f"[user_db] upsert failed for user {user_id} / {table_suffix}: {e}")


def get_user_data(
    user_id: int,
    table_suffix: str,
    db_engine,
) -> dict:
    """
    Returns all key-value pairs from a user's table as a plain dict.
    Returns {} if the table doesn't exist or on any error.
    """
    try:
        with db_engine.connect() as conn:
            rows = conn.execute(text(
                f"SELECT key, value FROM user_{user_id}_{table_suffix}"
            )).fetchall()
        return {row[0]: row[1] for row in rows}
    except Exception:
        return {}


def log_user_activity(
    user_id: int,
    action: str,
    details: dict | None,
    ip_address: str | None,
    db_engine,
) -> None:
    """
    Appends one row to the user's activity log.
    Silently no-ops if the table doesn't exist.
    """
    try:
        with db_engine.connect() as conn:
            conn.execute(text(f"""
                INSERT INTO user_{user_id}_activity (action, details, ip_address)
                VALUES (:action, :details, :ip)
            """), {
                "action":  action,
                "details": json.dumps(details) if details else None,
                "ip":      ip_address,
            })
            conn.commit()
    except Exception as e:
        print(f"[user_db] activity log failed for user {user_id}: {e}")
