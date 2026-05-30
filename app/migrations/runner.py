"""
Single source of truth for runtime database migrations.

Called by:
  - FastAPI lifespan (app.main) at backend startup
  - Celery worker_init signal (app.celery_app) at worker boot

Both invoke ``run_all_migrations()`` so that every process — web, beat, worker —
operates on a fully-migrated schema. This eliminates the boot race where Celery
beat fires a due task before the web app has finished its startup migration
pass (the symptom: ``sqlite3.OperationalError: no such column: ...``).

Works across SQLite (dev) and PostgreSQL / Supabase (production). All
operations are idempotent — safe to call on every boot from every process.

────────────────────────────────────────────────────────────────────────────
To add a new column going forward:

    Append a tuple to ``COLUMN_MIGRATIONS`` of the shape

        (table, column, postgres_def, sqlite_def)

    where the two ``_def`` strings are the SQL fragment after
    ``ADD COLUMN <name>`` (type + constraints + default).

To add a one-shot data sweep:

    Write a function that takes a Session and call it from
    ``run_all_migrations`` inside the data-sweep block.
────────────────────────────────────────────────────────────────────────────
"""

from __future__ import annotations

import logging
from typing import Optional

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.database import IS_POSTGRES, SessionLocal, engine as _default_engine, init_db

logger = logging.getLogger("campify.migrations")


# ── Canonical column-additions table ─────────────────────────────────────
# Each entry: (table, column, postgres_def, sqlite_def). The ``_def`` is the
# SQL fragment placed after ``ADD COLUMN <name>``.
#
# Notes on types:
#   * Booleans → ``BOOLEAN NOT NULL DEFAULT FALSE`` on Postgres,
#                ``INTEGER NOT NULL DEFAULT 0`` on SQLite (Python's Boolean
#                column maps to INTEGER 0/1 on SQLite).
#   * JSON     → ``JSONB`` on Postgres, ``TEXT`` on SQLite (serialised JSON).
#   * Timestamps → ``TIMESTAMPTZ`` on Postgres, ``TEXT`` on SQLite (ISO-8601).
#   * For ``NOT NULL`` columns you MUST also specify a DEFAULT — Postgres
#     rejects ``ADD COLUMN ... NOT NULL`` without one on a populated table.
COLUMN_MIGRATIONS: list[tuple[str, str, str, str]] = [
    # ── Block 1 — UUID for all public entities ──────────────────────────
    ("users",   "uuid", "TEXT", "TEXT"),
    ("prices",  "uuid", "TEXT", "TEXT"),
    ("orders",  "uuid", "TEXT", "TEXT"),
    ("reviews", "uuid", "TEXT", "TEXT"),

    # ── Block 4A — user lifecycle ───────────────────────────────────────
    ("users", "is_paused",                 "BOOLEAN NOT NULL DEFAULT FALSE", "INTEGER NOT NULL DEFAULT 0"),
    ("users", "paused_at",                 "TIMESTAMPTZ",                    "TEXT"),
    ("users", "paused_by",                 "TEXT",                           "TEXT"),
    ("users", "pause_reason",              "TEXT",                           "TEXT"),
    ("users", "reactivation_requested_at", "TIMESTAMPTZ",                    "TEXT"),
    ("users", "deletion_requested_at",     "TIMESTAMPTZ",                    "TEXT"),
    ("users", "deletion_request_reason",   "TEXT",                           "TEXT"),
    ("users", "is_deleted",                "BOOLEAN NOT NULL DEFAULT FALSE", "INTEGER NOT NULL DEFAULT 0"),
    ("users", "deleted_at",                "TIMESTAMPTZ",                    "TEXT"),

    # ── Block 1A — link-based email verification ────────────────────────
    ("users", "email_verify_token",     "TEXT",         "TEXT"),
    ("users", "email_verify_token_exp", "TIMESTAMPTZ",  "TEXT"),
    ("users", "email_verified_at",      "TIMESTAMPTZ",  "TEXT"),

    # ── Password reset ──────────────────────────────────────────────────
    ("users", "password_reset_token",     "TEXT",        "TEXT"),
    ("users", "password_reset_token_exp", "TIMESTAMPTZ", "TEXT"),

    # ── Block 10 — TOTP / MFA ───────────────────────────────────────────
    ("users", "mfa_enabled",      "BOOLEAN NOT NULL DEFAULT FALSE", "INTEGER NOT NULL DEFAULT 0"),
    ("users", "mfa_secret",       "TEXT",                           "TEXT"),
    ("users", "mfa_backup_codes", "JSONB",                          "TEXT"),

    # ── Block 3B — notification deep link ───────────────────────────────
    ("notifications", "action_url", "TEXT", "TEXT"),

    # ── Block 6 — profile & cover photos ────────────────────────────────
    ("users", "banner_url", "TEXT",                  "TEXT"),
    ("users", "bio",        "TEXT",                  "TEXT"),
    ("users", "faculty",    "TEXT",                  "TEXT"),
    ("users", "karma_tier", "TEXT DEFAULT 'Bronze'", "TEXT DEFAULT 'Bronze'"),

    # ── Announcement banner slide fields ────────────────────────────────
    ("announcements", "banner_url", "TEXT", "TEXT"),
    ("announcements", "cta_label",  "TEXT", "TEXT"),
    ("announcements", "cta_href",   "TEXT", "TEXT"),

    # ── Inquiry reply thread fields ─────────────────────────────────────
    ("inquiries", "seller_reply", "TEXT",        "TEXT"),
    ("inquiries", "replied_at",   "TIMESTAMPTZ", "TEXT"),
    ("inquiries", "label",        "TEXT",        "TEXT"),

    # ── Vacation mode ───────────────────────────────────────────────────
    ("prices", "paused_by_vacation", "BOOLEAN NOT NULL DEFAULT FALSE", "INTEGER NOT NULL DEFAULT 0"),

    # ── Delivery fee (optional, when "delivery" is among delivery_options) ─
    ("prices", "delivery_fee", "DOUBLE PRECISION", "FLOAT"),

    # ── Product videos (JSON array of Cloudinary URLs) ──────────────────
    ("prices", "videos", "TEXT", "TEXT"),

    # ── Block 1/3 — FTS search-weight boost priority (A > B > C > D) ────
    ("prices", "search_weight", "VARCHAR(1) DEFAULT 'C'", "TEXT DEFAULT 'C'"),

    # ── Messages ────────────────────────────────────────────────────────
    ("conversations",   "uuid",         "TEXT",                           "TEXT"),
    ("direct_messages", "is_automated", "BOOLEAN NOT NULL DEFAULT FALSE", "INTEGER NOT NULL DEFAULT 0"),

    # ── Block 5 — Reviews verified-purchase flag ────────────────────────
    ("reviews", "is_verified_purchase", "BOOLEAN NOT NULL DEFAULT FALSE", "INTEGER NOT NULL DEFAULT 0"),

    # ── Block 5 — Conversation listing context ──────────────────────────
    ("conversations", "listing_id",
        "INTEGER REFERENCES prices(id) ON DELETE SET NULL",
        "INTEGER"),

    # ── Block 5 — Leads anonymous tracking ──────────────────────────────
    ("leads", "ip_hash", "TEXT", "TEXT"),

    # ── Structured-locations rollout (Block 11) ─────────────────────────
    # JSON array of canonical pickup spots. Empty array = listing blocked
    # from publish. ``needs_location_update`` flags rows that the legacy
    # purge swept so the seller dashboard can prompt for a fresh location.
    ("prices", "locations",             "TEXT NOT NULL DEFAULT '[]'",     "TEXT NOT NULL DEFAULT '[]'"),
    ("prices", "needs_location_update", "BOOLEAN NOT NULL DEFAULT FALSE", "INTEGER NOT NULL DEFAULT 0"),
]


# ── Helpers ──────────────────────────────────────────────────────────────

def _has_table(inspector, table: str) -> bool:
    try:
        return inspector.has_table(table)
    except Exception:
        return False


def _has_column(inspector, table: str, column: str) -> bool:
    try:
        return column in {c["name"] for c in inspector.get_columns(table)}
    except Exception:
        return False


def _apply_column_migrations(engine: Engine) -> int:
    """Add any column in ``COLUMN_MIGRATIONS`` that doesn't already exist."""
    inspector = inspect(engine)
    added = 0
    for table, col, pg_def, sqlite_def in COLUMN_MIGRATIONS:
        if not _has_table(inspector, table):
            # Model may not be deployed in this environment yet — skip.
            continue
        if _has_column(inspector, table, col):
            continue
        col_def = pg_def if IS_POSTGRES else sqlite_def
        try:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_def}"))
            logger.info(
                "migrations: added %s.%s [%s]",
                table, col, "postgres" if IS_POSTGRES else "sqlite",
            )
            added += 1
        except Exception as exc:
            # Race: another process may have added the column between our
            # check and the ALTER. Re-inspect; only re-raise if still missing.
            if _has_column(inspect(engine), table, col):
                logger.debug("migrations: %s.%s already added by another process", table, col)
            else:
                logger.exception("migrations: ADD COLUMN %s.%s failed: %s", table, col, exc)
    return added


# ── Data sweeps ──────────────────────────────────────────────────────────

def _backfill_uuids_and_indexes(engine: Engine) -> None:
    """
    SQLite-only: backfill ``uuid`` on legacy rows that pre-date the column
    and create the UNIQUE indexes that enforce uuid integrity. Postgres
    populates uuid via column DEFAULT / SQLAlchemy ``default=`` and uses its
    own indexes via ``_run_postgres_migrations``.
    """
    if IS_POSTGRES:
        return
    inspector = inspect(engine)
    with engine.begin() as conn:
        # Backfill — only touch tables/columns that actually exist (the
        # ADD COLUMN pass would have created the uuid column already, but
        # defend against partial schemas in test/dev environments).
        for table in ("users", "prices", "orders", "reviews"):
            if _has_table(inspector, table) and _has_column(inspector, table, "uuid"):
                conn.execute(text(
                    f"UPDATE {table} SET uuid = lower(hex(randomblob(16))) "
                    f"WHERE uuid IS NULL"
                ))
        # UNIQUE indexes on uuid (idempotent).
        for table in ("users", "prices", "orders", "reviews"):
            if _has_table(inspector, table) and _has_column(inspector, table, "uuid"):
                conn.execute(text(
                    f"CREATE UNIQUE INDEX IF NOT EXISTS idx_{table}_uuid "
                    f"ON {table}(uuid)"
                ))


def _backfill_email_verified(engine: Engine) -> None:
    """
    SQLite-only: mark legacy users as already email-verified so they don't
    get locked out by the link-based verification rollout. New signups
    still go through the normal verify flow.
    """
    if IS_POSTGRES:
        return
    inspector = inspect(engine)
    if not (_has_table(inspector, "users") and _has_column(inspector, "users", "email_verified")):
        return
    with engine.begin() as conn:
        conn.execute(text("""
            UPDATE users SET email_verified = 1
            WHERE email_verified IS NULL OR email_verified = 0
        """))


def _purge_legacy_locations(db: Session) -> int:
    """
    Auto-block every listing whose ``location`` is in the legacy purge set
    (Angola, Freedom Park, Nithub, GTBank bus stop, …). Idempotent — once a
    row has had its ``location`` cleared, it won't match the WHERE again.
    """
    try:
        from app.constants.locations import OLD_LOCATIONS_TO_PURGE
    except Exception:
        return 0
    if not OLD_LOCATIONS_TO_PURGE:
        return 0

    legacy = sorted(OLD_LOCATIONS_TO_PURGE)
    placeholders = ", ".join(f":legacy_{i}" for i in range(len(legacy)))
    params: dict[str, object] = {
        f"legacy_{i}": name.lower() for i, name in enumerate(legacy)
    }
    needs_update_true = "TRUE" if IS_POSTGRES else "1"

    sql = text(f"""
        UPDATE prices
           SET location              = NULL,
               locations             = '[]',
               listing_status        = 'draft',
               needs_location_update = {needs_update_true}
         WHERE LOWER(TRIM(COALESCE(location, ''))) IN ({placeholders})
    """)
    try:
        result = db.execute(sql, params)
        rowcount = result.rowcount or 0
        db.commit()
        return int(rowcount)
    except Exception:
        db.rollback()
        raise


# ── Public entry point ───────────────────────────────────────────────────

def run_all_migrations(
    engine: Optional[Engine] = None,
    session: Optional[Session] = None,
) -> dict[str, int]:
    """
    Master migration entry point. Idempotent and safe to call from any process.

    Order of operations:
      1. ``init_db()`` — creates tables (SQLAlchemy ``create_all``) and runs
         dialect-specific bulk migrations (FTS5 on SQLite; pg_trgm / GIN /
         tsvector / partial indexes on Postgres).
      2. ``_apply_column_migrations`` — adds any missing column from the
         canonical ``COLUMN_MIGRATIONS`` list. Works on both dialects.
      3. Data sweeps — one-shot rewrites that depend on the columns being
         present (e.g. legacy-locations purge).

    Returns a small summary dict suitable for logging.
    """
    own_session = session is None
    engine = engine or _default_engine
    session = session or SessionLocal()

    summary: dict[str, int] = {"added_columns": 0, "purged_listings": 0}

    try:
        # 1. Schema bootstrap + dialect-specific bulk migrations.
        try:
            init_db()
        except Exception as exc:
            # init_db swallows its own errors and prints them, but defend
            # against unexpected breakage so the rest of the pass still runs.
            logger.exception("migrations: init_db failed: %s", exc)

        # 2. Cross-dialect ADD COLUMN pass — the canonical list above.
        try:
            summary["added_columns"] = _apply_column_migrations(engine)
        except Exception as exc:
            logger.exception("migrations: column-add pass failed: %s", exc)

        # 3. One-shot data sweeps. Add new ones here.
        try:
            _backfill_uuids_and_indexes(engine)
        except Exception as exc:
            logger.exception("migrations: uuid backfill failed: %s", exc)
        try:
            _backfill_email_verified(engine)
        except Exception as exc:
            logger.exception("migrations: email_verified backfill failed: %s", exc)
        try:
            summary["purged_listings"] = _purge_legacy_locations(session)
        except Exception as exc:
            logger.exception("migrations: legacy-locations sweep failed: %s", exc)

        logger.info("migrations: complete — %s", summary)
    finally:
        if own_session:
            session.close()

    return summary


# Backwards-compat alias so any straggler import doesn't break.
run_locations_migration = run_all_migrations
