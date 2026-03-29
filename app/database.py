import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data.db")
DATABASE_ECHO = os.getenv("DATABASE_ECHO", "false").lower() == "true"

if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        connect_args={
            "check_same_thread": False,
            "timeout": 30,
        },
        echo=DATABASE_ECHO,
    )
else:
    engine = create_engine(
        DATABASE_URL,
        echo=DATABASE_ECHO,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        pool_timeout=30,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _apply_migrations(eng) -> None:
    """
    Safe ALTER TABLE / CREATE TABLE migrations using IF NOT EXISTS guards.
    Called once at startup — idempotent; safe to re-run on every boot.
    """
    # Each entry: (table, column, sqlite_type_and_default)
    _new_columns = [
        # Block 4A — user lifecycle
        ("users", "is_paused",                   "INTEGER DEFAULT 0"),
        ("users", "paused_at",                   "TEXT"),
        ("users", "paused_by",                   "TEXT"),
        ("users", "pause_reason",                "TEXT"),
        ("users", "reactivation_requested_at",   "TEXT"),
        ("users", "deletion_requested_at",       "TEXT"),
        ("users", "deletion_request_reason",     "TEXT"),
        ("users", "is_deleted",                  "INTEGER DEFAULT 0"),
        ("users", "deleted_at",                  "TEXT"),
    ]

    with eng.connect() as conn:
        # ── Add missing columns (SQLite has no IF NOT EXISTS for ADD COLUMN) ──
        for table, col, col_def in _new_columns:
            # Check whether column already exists
            rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
            existing = {r[1] for r in rows}  # r[1] is column name
            if col not in existing:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_def}"))

        # ── New tables (CREATE TABLE IF NOT EXISTS is safe to re-run) ──────────
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS cloudinary_assets (
                id          INTEGER PRIMARY KEY,
                user_id     INTEGER NOT NULL REFERENCES users(id),
                public_id   TEXT NOT NULL UNIQUE,
                url         TEXT NOT NULL,
                folder      TEXT NOT NULL,
                asset_type  TEXT NOT NULL,
                bytes       INTEGER,
                format      TEXT,
                uploaded_at TEXT DEFAULT (datetime('now')),
                listing_id  INTEGER REFERENCES prices(id)
            )
        """))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS admin_events (
                id              INTEGER PRIMARY KEY,
                event_type      TEXT NOT NULL,
                user_id         INTEGER REFERENCES users(id),
                user_email      TEXT,
                user_role       TEXT,
                payload         TEXT,
                is_read         INTEGER DEFAULT 0,
                requires_action INTEGER DEFAULT 0,
                created_at      TEXT DEFAULT (datetime('now'))
            )
        """))

        # ── Indexes ──────────────────────────────────────────────────────────
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_admin_events_created "
            "ON admin_events(created_at)"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_admin_events_unread "
            "ON admin_events(is_read, requires_action)"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_cloudinary_user "
            "ON cloudinary_assets(user_id)"
        ))

        conn.commit()


def init_db():
    """Create all tables. For SQLite: enable WAL, create FTS5 index, and add query indexes."""
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print("⚠️  DB init failed:", e)
        return

    if not DATABASE_URL.startswith("sqlite"):
        return

    with engine.connect() as conn:
        # WAL mode — dramatically reduces "database is locked" errors
        conn.execute(text("PRAGMA journal_mode=WAL"))
        conn.execute(text("PRAGMA synchronous=NORMAL"))

        # ── FTS5 virtual table (full-text search on prices) ──────────────
        conn.execute(text("""
            CREATE VIRTUAL TABLE IF NOT EXISTS prices_fts
            USING fts5(
                name, description, retailer, location,
                content='prices', content_rowid='id'
            )
        """))

        # Keep FTS5 in sync via triggers
        conn.execute(text("""
            CREATE TRIGGER IF NOT EXISTS prices_fts_insert
            AFTER INSERT ON prices BEGIN
                INSERT INTO prices_fts(rowid, name, description, retailer, location)
                VALUES (new.id, new.name, new.description, new.retailer, new.location);
            END
        """))
        conn.execute(text("""
            CREATE TRIGGER IF NOT EXISTS prices_fts_update
            AFTER UPDATE ON prices BEGIN
                INSERT INTO prices_fts(prices_fts, rowid, name, description, retailer, location)
                VALUES ('delete', old.id, old.name, old.description, old.retailer, old.location);
                INSERT INTO prices_fts(rowid, name, description, retailer, location)
                VALUES (new.id, new.name, new.description, new.retailer, new.location);
            END
        """))
        conn.execute(text("""
            CREATE TRIGGER IF NOT EXISTS prices_fts_delete
            AFTER DELETE ON prices BEGIN
                INSERT INTO prices_fts(prices_fts, rowid, name, description, retailer, location)
                VALUES ('delete', old.id, old.name, old.description, old.retailer, old.location);
            END
        """))

        # ── Query performance indexes ─────────────────────────────────────
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_prices_category   ON prices(category_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_prices_price       ON prices(price)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_prices_created_at  ON prices(submitted_at)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_prices_status      ON prices(status)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_prices_seller_id   ON prices(submitted_by)"))

        conn.commit()

    # ── Block 1 + 4: safe column / table migrations ───────────────────────────
    _apply_migrations(engine)
