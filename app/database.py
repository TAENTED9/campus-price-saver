import os
import warnings
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy.pool import QueuePool
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

IS_POSTGRES = bool(
    DATABASE_URL and (
        "postgresql" in DATABASE_URL or
        DATABASE_URL.startswith("postgres://")
    )
)

if IS_POSTGRES:
    # Fix Supabase giving "postgres://" instead of "postgresql+psycopg2://"
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)

    if ":6543" in DATABASE_URL:
        warnings.warn(
            "Supabase Transaction mode (port 6543) detected. "
            "Switch to Session mode (port 5432) to avoid "
            "prepared statement errors with SQLAlchemy.",
            RuntimeWarning,
        )

    # Enforce TLS for any production Postgres (Supabase, RDS, etc.). The
    # default sslmode in libpq is 'prefer', which silently downgrades to
    # unencrypted on a MITM. 'require' guarantees TLS.
    _is_production_env = os.getenv("ENVIRONMENT", "development") == "production"
    _ssl_required = (
        _is_production_env
        or "supabase.co" in DATABASE_URL
        or "supabase.com" in DATABASE_URL
        or "pooler.supabase" in DATABASE_URL
    )
    _connect_args = {
        "connect_timeout": 10,
        "application_name": "campify",
        "options": "-c timezone=UTC",
    }
    if _ssl_required and "sslmode=" not in DATABASE_URL:
        _connect_args["sslmode"] = "require"

    engine = create_engine(
        DATABASE_URL,
        poolclass=QueuePool,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        pool_recycle=300,
        connect_args=_connect_args,
        echo=os.getenv("DATABASE_ECHO", "false").lower() == "true",
    )
else:
    SQLITE_URL = "sqlite:///./data.db"
    engine = create_engine(
        SQLITE_URL,
        connect_args={
            "check_same_thread": False,
            "timeout": 30,
        },
        echo=os.getenv("DATABASE_ECHO", "false").lower() == "true",
    )

    @event.listens_for(engine, "connect")
    def set_sqlite_pragmas(dbapi_conn, _):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA cache_size=-64000")
        cursor.execute("PRAGMA temp_store=MEMORY")
        cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables then run DB-specific migrations."""
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print("⚠️  DB init failed:", e)
        return

    if IS_POSTGRES:
        _run_postgres_migrations()
    else:
        _run_sqlite_migrations()


# ── PostgreSQL migrations ──────────────────────────────────────────────────────

def _run_postgres_migrations():
    with engine.connect() as conn:
        # Extensions
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS pgcrypto"))
        conn.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"'))
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))

        # Partial indexes — users
        _pg_try(conn, """
            CREATE INDEX IF NOT EXISTS idx_active_users
            ON users(id, role, created_at)
            WHERE is_active = TRUE AND is_deleted = FALSE
        """)
        # Admin user-list filter indexes (role + status combos)
        _pg_try(conn, "CREATE INDEX IF NOT EXISTS idx_users_role         ON users(role)")
        _pg_try(conn, "CREATE INDEX IF NOT EXISTS idx_users_is_suspended ON users(is_suspended)")
        _pg_try(conn, "CREATE INDEX IF NOT EXISTS idx_users_is_paused    ON users(is_paused)")
        _pg_try(conn, "CREATE INDEX IF NOT EXISTS idx_users_is_banned    ON users(is_banned)")
        _pg_try(conn, "CREATE INDEX IF NOT EXISTS idx_users_is_deleted   ON users(is_deleted)")
        _pg_try(conn, "CREATE INDEX IF NOT EXISTS idx_users_created_at   ON users(created_at)")
        _pg_try(conn, "CREATE INDEX IF NOT EXISTS idx_users_role_lifecycle ON users(role, is_deleted, is_suspended, is_paused, is_banned)")
        _pg_try(conn, "CREATE INDEX IF NOT EXISTS idx_seller_verifs_status ON seller_verifications(status, submitted_at DESC)")
        _pg_try(conn, "CREATE INDEX IF NOT EXISTS idx_seller_verifs_user   ON seller_verifications(user_id)")

        # Partial indexes — prices (local table name; listings alias added when table exists)
        _pg_try(conn, """
            CREATE INDEX IF NOT EXISTS idx_active_prices_browse
            ON prices(category_id, price, submitted_at DESC, submitted_by)
            WHERE status = 'active'
        """)
        _pg_try(conn, """
            CREATE INDEX IF NOT EXISTS idx_active_listings_browse
            ON listings(category, price, created_at DESC, seller_id)
            WHERE status = 'active'
        """)

        _pg_try(conn, """
            CREATE INDEX IF NOT EXISTS idx_pending_verifs
            ON seller_verifications(user_id, submitted_at)
            WHERE status = 'Pending'
        """)
        _pg_try(conn, """
            CREATE INDEX IF NOT EXISTS idx_unread_notifs
            ON notifications(user_id, created_at DESC)
            WHERE is_read = FALSE
        """)
        _pg_try(conn, """
            CREATE INDEX IF NOT EXISTS idx_active_flash_sales
            ON flash_sales(price_id, end_time)
            WHERE is_active = TRUE
        """)
        _pg_try(conn, """
            CREATE INDEX IF NOT EXISTS idx_active_announcements
            ON announcements(audience, created_at DESC)
            WHERE is_active = TRUE
        """)

        # GIN indexes for JSONB
        _pg_try(conn, """
            CREATE INDEX IF NOT EXISTS idx_profiles_metadata_gin
            ON profiles USING GIN (metadata)
        """)
        _pg_try(conn, """
            CREATE INDEX IF NOT EXISTS idx_user_settings_prefs_gin
            ON user_settings USING GIN (preferences)
        """)
        _pg_try(conn, """
            CREATE INDEX IF NOT EXISTS idx_user_settings_updated
            ON user_settings(updated_at DESC)
        """)

        # Full-text search — prices table (current)
        _pg_try(conn, """
            CREATE INDEX IF NOT EXISTS idx_prices_fts
            ON prices USING GIN (
                to_tsvector('english',
                    coalesce(name,'') || ' ' ||
                    coalesce(description,'') || ' ' ||
                    coalesce(location,'')
                )
            )
        """)

        # Full-text search — listings table (future)
        _pg_try(conn, """
            CREATE INDEX IF NOT EXISTS idx_listings_fts
            ON listings USING GIN (
                to_tsvector('english',
                    coalesce(title,'') || ' ' ||
                    coalesce(description,'') || ' ' ||
                    coalesce(category,'') || ' ' ||
                    coalesce(location,'')
                )
            )
        """)

        # Trigram indexes for fuzzy search
        _pg_try(conn, "CREATE INDEX IF NOT EXISTS idx_prices_name_trgm ON prices USING GIN (name gin_trgm_ops)")
        _pg_try(conn, "CREATE INDEX IF NOT EXISTS idx_listings_title_trgm ON listings USING GIN (title gin_trgm_ops)")

        # Composite indexes
        _pg_try(conn, "CREATE INDEX IF NOT EXISTS idx_prices_category_price ON prices(category_id, price, status) WHERE status = 'active'")
        _pg_try(conn, "CREATE INDEX IF NOT EXISTS idx_prices_seller_status ON prices(submitted_by, status, submitted_at DESC)")
        _pg_try(conn, "CREATE INDEX IF NOT EXISTS idx_listings_seller_status ON listings(seller_id, status, created_at DESC)")
        _pg_try(conn, "CREATE INDEX IF NOT EXISTS idx_messages_conversation ON direct_messages(conversation_id, created_at DESC)")
        _pg_try(conn, "CREATE INDEX IF NOT EXISTS idx_wishlist_user_listing ON wishlists(user_id, listing_id)")
        _pg_try(conn, "CREATE INDEX IF NOT EXISTS idx_login_history_user_time ON login_history(user_id, logged_in_at DESC)")

        # Refresh token table (for secure "Remember Me")
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS refresh_tokens (
                id          SERIAL PRIMARY KEY,
                user_id     INTEGER NOT NULL
                            REFERENCES users(id) ON DELETE CASCADE,
                token_hash  TEXT NOT NULL UNIQUE,
                expires_at  TIMESTAMPTZ NOT NULL,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                revoked     BOOLEAN NOT NULL DEFAULT FALSE,
                revoked_at  TIMESTAMPTZ,
                ip_address  TEXT,
                user_agent  TEXT
            )
        """))
        _pg_try(conn, """
            CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user
            ON refresh_tokens(user_id, revoked)
            WHERE revoked = FALSE
        """)
        _pg_try(conn, """
            CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash
            ON refresh_tokens(token_hash)
            WHERE revoked = FALSE
        """)

        # Password reset columns
        _pg_try(conn, "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token TEXT")
        _pg_try(conn, "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token_exp TIMESTAMPTZ")

        # Block 10 — MFA columns
        _pg_try(conn, "ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE")
        _pg_try(conn, "ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret TEXT")
        _pg_try(conn, "ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_backup_codes JSONB")

        # Inquiry reply thread fields
        _pg_try(conn, "ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS seller_reply TEXT")
        _pg_try(conn, "ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ")
        _pg_try(conn, "ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS label TEXT")

        # Block 5 — Reviews new fields
        _pg_try(conn, "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_verified_purchase BOOLEAN NOT NULL DEFAULT FALSE")

        # Block 5 — Conversation listing context
        _pg_try(conn, "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS listing_id INTEGER REFERENCES prices(id) ON DELETE SET NULL")

        # Block 5 — Leads anonymous tracking
        _pg_try(conn, "ALTER TABLE leads ADD COLUMN IF NOT EXISTS ip_hash TEXT")

        # Block 5 — Review performance indexes
        _pg_try(conn, "CREATE INDEX IF NOT EXISTS idx_reviews_listing_id ON reviews(listing_id)")
        _pg_try(conn, "CREATE INDEX IF NOT EXISTS idx_reviews_seller_id ON reviews(seller_id)")

        # updated_at trigger function
        conn.execute(text("""
            CREATE OR REPLACE FUNCTION update_updated_at()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = NOW();
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
        """))
        for tbl in ["users", "profiles", "listings", "prices"]:
            _pg_try(conn, f"DROP TRIGGER IF EXISTS {tbl}_updated_at ON {tbl}")
            _pg_try(conn, f"""
                CREATE TRIGGER {tbl}_updated_at
                BEFORE UPDATE ON {tbl}
                FOR EACH ROW EXECUTE FUNCTION update_updated_at()
            """)

        conn.commit()


def _pg_try(conn, sql: str) -> None:
    """
    Execute a PostgreSQL DDL statement inside a SAVEPOINT so a failure
    only rolls back that one statement — not the entire transaction.
    Safe to call when a table/column doesn't exist yet.
    """
    try:
        conn.execute(text("SAVEPOINT _pg_try_sp"))
        conn.execute(text(sql))
        conn.execute(text("RELEASE SAVEPOINT _pg_try_sp"))
    except Exception:
        conn.execute(text("ROLLBACK TO SAVEPOINT _pg_try_sp"))


# ── SQLite migrations ──────────────────────────────────────────────────────────

def _run_sqlite_migrations():
    """All SQLite-specific setup. Idempotent — safe to re-run on every boot."""
    with engine.connect() as conn:
        # WAL mode
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
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_listings_status_category ON prices(status, category_id, price)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_notifs_user_read   ON notifications(user_id, is_read, created_at)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_wishlist_user      ON wishlists(user_id, listing_id)"))

        # ── Admin user-list filter indexes (added so role + status filter
        # combinations stay fast at 10k+ users) ──────────────────────────
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_users_role          ON users(role)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_users_is_suspended  ON users(is_suspended)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_users_is_paused     ON users(is_paused)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_users_is_banned     ON users(is_banned)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_users_is_deleted    ON users(is_deleted)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_users_created_at    ON users(created_at)"))
        # Composite for the most common admin filter combo (role + lifecycle).
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_users_role_lifecycle ON users(role, is_deleted, is_suspended, is_paused, is_banned)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_users_email_lower    ON users(email)"))
        # Seller verification status filter on admin/seller page.
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_seller_verifs_status ON seller_verifications(status, submitted_at DESC)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_seller_verifs_user   ON seller_verifications(user_id)"))

        # ── Conversations / direct_messages tables ────────────────────────
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_a_id INTEGER NOT NULL REFERENCES users(id),
                user_b_id INTEGER NOT NULL REFERENCES users(id),
                last_message_at DATETIME,
                last_message_preview TEXT,
                created_at DATETIME DEFAULT (datetime('now'))
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS direct_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversation_id INTEGER NOT NULL REFERENCES conversations(id),
                sender_id INTEGER NOT NULL REFERENCES users(id),
                content TEXT NOT NULL,
                is_read INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT (datetime('now'))
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_conv_users ON conversations(user_a_id, user_b_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_dm_conv ON direct_messages(conversation_id, created_at)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_dm_sender ON direct_messages(sender_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active, audience)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, target_type)"))

        conn.commit()

    # ── Column additions and legacy table creations ───────────────────────────
    _apply_migrations(engine)

    # ── Refresh tokens table ──────────────────────────────────────────────────
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS refresh_tokens (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id     INTEGER NOT NULL
                            REFERENCES users(id) ON DELETE CASCADE,
                token_hash  TEXT NOT NULL UNIQUE,
                expires_at  TEXT NOT NULL,
                created_at  TEXT DEFAULT (datetime('now')),
                revoked     INTEGER NOT NULL DEFAULT 0,
                revoked_at  TEXT,
                ip_address  TEXT,
                user_agent  TEXT
            )
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user
            ON refresh_tokens(user_id, revoked)
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash
            ON refresh_tokens(token_hash)
        """))
        conn.commit()


def _apply_migrations(eng) -> None:
    """
    Safe ALTER TABLE / CREATE TABLE migrations using IF NOT EXISTS guards.
    Called once at startup — idempotent; safe to re-run on every boot.
    """
    # Each entry: (table, column, sqlite_type_and_default)
    _new_columns = [
        # Block 1 — UUID for all public entities
        ("users",   "uuid", "TEXT"),
        ("prices",  "uuid", "TEXT"),
        ("orders",  "uuid", "TEXT"),
        ("reviews", "uuid", "TEXT"),
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
        # Block 1A — link-based email verification
        ("users", "email_verify_token",          "TEXT"),
        ("users", "email_verify_token_exp",      "TEXT"),
        ("users", "email_verified_at",           "TEXT"),
        # Password reset
        ("users", "password_reset_token",        "TEXT"),
        ("users", "password_reset_token_exp",    "TEXT"),
        # Block 10 — TOTP / MFA
        ("users", "mfa_enabled",                 "INTEGER NOT NULL DEFAULT 0"),
        ("users", "mfa_secret",                  "TEXT"),
        ("users", "mfa_backup_codes",            "TEXT"),
        # Block 3B — notification deep link
        ("notifications", "action_url",          "TEXT"),
        # Block 6 — profile & cover photos
        ("users", "banner_url",                  "TEXT"),
        ("users", "bio",                         "TEXT"),
        ("users", "faculty",                     "TEXT"),
        ("users", "karma_tier",                  "TEXT DEFAULT 'Bronze'"),
        # Announcement banner slide fields
        ("announcements", "banner_url",          "TEXT"),
        ("announcements", "cta_label",           "TEXT"),
        ("announcements", "cta_href",            "TEXT"),
        # Inquiry reply thread fields
        ("inquiries", "seller_reply",            "TEXT"),
        ("inquiries", "replied_at",              "TEXT"),
        ("inquiries", "label",                   "TEXT"),
        # Vacation mode — track which listings were paused by vacation vs manually
        ("prices", "paused_by_vacation",         "INTEGER DEFAULT 0"),
        # Optional delivery fee charged when delivery is among the listing's options
        ("prices", "delivery_fee",               "FLOAT"),
        # Messages — conversation UUID + automated message flag
        ("conversations",   "uuid",              "TEXT"),
        ("direct_messages", "is_automated",      "INTEGER DEFAULT 0"),
        # Block 5 — Reviews new fields
        ("reviews", "is_verified_purchase",      "INTEGER DEFAULT 0"),
        # Block 5 — Conversation listing context
        ("conversations", "listing_id",          "INTEGER"),
        # Block 5 — Leads anonymous tracking
        ("leads", "ip_hash",                     "TEXT"),
    ]

    with eng.connect() as conn:
        # ── Add missing columns (SQLite has no IF NOT EXISTS for ADD COLUMN) ──
        for table, col, col_def in _new_columns:
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
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS login_history (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                ip_address   TEXT,
                user_agent   TEXT,
                device       TEXT,
                location     TEXT,
                logged_in_at TEXT DEFAULT (datetime('now')),
                was_notified INTEGER DEFAULT 0
            )
        """))

        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id, logged_in_at DESC)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_admin_events_created ON admin_events(created_at)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_admin_events_unread ON admin_events(is_read, requires_action)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_cloudinary_user ON cloudinary_assets(user_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_listings_views ON prices(view_count DESC)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role, is_deleted)"))

        # ── UUID backfill for existing rows ───────────────────────────────
        conn.execute(text("UPDATE users  SET uuid = lower(hex(randomblob(16))) WHERE uuid IS NULL"))
        conn.execute(text("UPDATE prices SET uuid = lower(hex(randomblob(16))) WHERE uuid IS NULL"))
        conn.execute(text("UPDATE orders SET uuid = lower(hex(randomblob(16))) WHERE uuid IS NULL"))
        conn.execute(text("UPDATE reviews SET uuid = lower(hex(randomblob(16))) WHERE uuid IS NULL"))

        # ── UUID unique indexes ───────────────────────────────────────────
        conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_uuid   ON users(uuid)"))
        conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS idx_prices_uuid  ON prices(uuid)"))
        conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_uuid  ON orders(uuid)"))
        conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_uuid ON reviews(uuid)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_reviews_listing_id ON reviews(listing_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_reviews_seller_id ON reviews(seller_id)"))

        # Mark all existing users as already email-verified so they aren't locked out.
        # New users registered after this migration must verify normally.
        conn.execute(text("""
            UPDATE users SET email_verified = 1
            WHERE email_verified IS NULL OR email_verified = 0
        """))

        conn.commit()


def _sqlite_add_column(conn, table: str, column: str, definition: str) -> None:
    """Add a column to a SQLite table, silently skip if it already exists."""
    try:
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {definition}"))
        conn.commit()
    except Exception:
        pass
