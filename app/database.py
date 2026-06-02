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
        # Extensions — wrapped so a restricted managed-Postgres role (no
        # superuser) can't abort the entire migration pass on CREATE EXTENSION.
        _pg_try(conn, "CREATE EXTENSION IF NOT EXISTS pgcrypto")
        _pg_try(conn, 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
        _pg_try(conn, "CREATE EXTENSION IF NOT EXISTS pg_trgm")
        # unaccent: strip diacritics for accent-insensitive search
        # (e.g. "café" matches "cafe"). Wrapped in _pg_try because
        # some managed Postgres providers restrict CREATE EXTENSION
        # without superuser; FTS still works without it.
        _pg_try(conn, "CREATE EXTENSION IF NOT EXISTS unaccent")

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

        # ── Block 2: Stored FTS — weighted tsvector + trigger ────────────────
        # Adds a stored, indexed search_vector column on the prices table,
        # populated by a BEFORE INSERT/UPDATE trigger. Weighted:
        #   A = name (title), B = brand/category/subcategory/condition,
        #   C = description, D = location.
        # Category name is resolved via JOIN to the categories table inside
        # the trigger function (no denormalized text column on prices).

        # 1. Stored column for the weighted tsvector
        _pg_try(conn, """
            ALTER TABLE prices
            ADD COLUMN IF NOT EXISTS search_vector TSVECTOR
        """)

        # 2. Search boost priority column (A/B/C/D) — populated by app code
        _pg_try(conn, """
            ALTER TABLE prices
            ADD COLUMN IF NOT EXISTS search_weight VARCHAR(1) DEFAULT 'C'
        """)

        # 3. Trigger function — recomputes search_vector before write
        _pg_try(conn, """
            CREATE OR REPLACE FUNCTION update_price_search_vector()
            RETURNS TRIGGER AS $$
            DECLARE
                v_category_name TEXT;
            BEGIN
                SELECT name INTO v_category_name
                FROM categories
                WHERE id = NEW.category_id;

                NEW.search_vector :=
                    setweight(to_tsvector('english',
                        coalesce(NEW.name, '')), 'A') ||
                    setweight(to_tsvector('english',
                        coalesce(NEW.brand, '')), 'B') ||
                    setweight(to_tsvector('english',
                        coalesce(v_category_name, '')), 'B') ||
                    setweight(to_tsvector('english',
                        coalesce(NEW.subcategory, '')), 'B') ||
                    setweight(to_tsvector('english',
                        coalesce(NEW.condition, '')), 'B') ||
                    setweight(to_tsvector('english',
                        coalesce(NEW.description, '')), 'C') ||
                    setweight(to_tsvector('english',
                        coalesce(NEW.location, '')), 'D');
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
        """)

        # 4. Attach trigger — fires BEFORE INSERT or UPDATE of indexed columns
        _pg_try(conn, "DROP TRIGGER IF EXISTS trig_price_search_vector ON prices")
        _pg_try(conn, """
            CREATE TRIGGER trig_price_search_vector
            BEFORE INSERT OR UPDATE OF
                name, brand, description, category_id,
                subcategory, condition, location
            ON prices
            FOR EACH ROW
            EXECUTE FUNCTION update_price_search_vector()
        """)

        # 5. Backfill existing rows whose search_vector is still NULL
        _pg_try(conn, """
            UPDATE prices p SET search_vector =
                setweight(to_tsvector('english',
                    coalesce(p.name, '')), 'A') ||
                setweight(to_tsvector('english',
                    coalesce(p.brand, '')), 'B') ||
                setweight(to_tsvector('english', coalesce(
                    (SELECT c.name FROM categories c
                     WHERE c.id = p.category_id), ''
                )), 'B') ||
                setweight(to_tsvector('english',
                    coalesce(p.subcategory, '')), 'B') ||
                setweight(to_tsvector('english',
                    coalesce(p.condition, '')), 'B') ||
                setweight(to_tsvector('english',
                    coalesce(p.description, '')), 'C') ||
                setweight(to_tsvector('english',
                    coalesce(p.location, '')), 'D')
            WHERE p.search_vector IS NULL
        """)

        # 6. GIN index on the stored vector — this is what powers
        #    sub-millisecond search at scale
        _pg_try(conn, """
            CREATE INDEX IF NOT EXISTS idx_prices_search_gin
            ON prices USING GIN (search_vector)
        """)

        # 7. Extra trigram index on description for typo tolerance on
        #    longer search queries (name already has one above)
        _pg_try(conn, """
            CREATE INDEX IF NOT EXISTS idx_prices_desc_trgm
            ON prices USING GIN (description gin_trgm_ops)
        """)

        # 8. Corrected partial browse index — uses listing_status (the real
        #    visibility column), not status (which is moderation only).
        #    The existing idx_active_prices_browse above filters on
        #    status='active' which never matches (status ∈ pending/approved/
        #    rejected) — left in place to avoid touching unrelated code,
        #    but this new index is the one buyer-facing browse queries hit.
        _pg_try(conn, """
            CREATE INDEX IF NOT EXISTS idx_active_prices_listing_browse
            ON prices (category_id, price, submitted_at DESC, submitted_by)
            WHERE listing_status = 'active'
        """)
        # ── End Block 2 ──────────────────────────────────────────────────────

        # Composite indexes
        _pg_try(conn, "CREATE INDEX IF NOT EXISTS idx_prices_category_price ON prices(category_id, price, status) WHERE status = 'active'")
        _pg_try(conn, "CREATE INDEX IF NOT EXISTS idx_prices_seller_status ON prices(submitted_by, status, submitted_at DESC)")
        _pg_try(conn, "CREATE INDEX IF NOT EXISTS idx_listings_seller_status ON listings(seller_id, status, created_at DESC)")
        _pg_try(conn, "CREATE INDEX IF NOT EXISTS idx_messages_conversation ON direct_messages(conversation_id, created_at DESC)")
        _pg_try(conn, "CREATE INDEX IF NOT EXISTS idx_wishlist_user_listing ON wishlists(user_id, listing_id)")
        _pg_try(conn, "CREATE INDEX IF NOT EXISTS idx_login_history_user_time ON login_history(user_id, logged_in_at DESC)")

        # Refresh token table (for secure "Remember Me")
        _pg_try(conn, """
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
        """)
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

        # Product videos column (account-wide limit of 3 per user)
        _pg_try(conn, "ALTER TABLE prices ADD COLUMN IF NOT EXISTS videos TEXT")

        # Structured-locations rollout — JSON array of canonical pickup
        # spots + flag for legacy-location rows that need a fresh location.
        # Also enforced by app/migrations/runner.py for both dialects; kept
        # here too as a belt-and-suspenders so any direct call to
        # _run_postgres_migrations() (tests, scripts) leaves the schema
        # complete.
        _pg_try(conn, "ALTER TABLE prices ADD COLUMN IF NOT EXISTS locations TEXT NOT NULL DEFAULT '[]'")
        _pg_try(conn, "ALTER TABLE prices ADD COLUMN IF NOT EXISTS needs_location_update BOOLEAN NOT NULL DEFAULT FALSE")

        # Block 5 — Review performance indexes
        _pg_try(conn, "CREATE INDEX IF NOT EXISTS idx_reviews_listing_id ON reviews(listing_id)")
        _pg_try(conn, "CREATE INDEX IF NOT EXISTS idx_reviews_seller_id ON reviews(seller_id)")

        # ── Block 8: Search analytics — partial index on zero-result queries ──
        # The composite (result_count, created_at) index from __table_args__
        # works for both DBs, but a partial index on Postgres is ~10× smaller
        # and faster for the "zero-result queries" admin view.
        _pg_try(conn, """
            CREATE INDEX IF NOT EXISTS idx_search_events_zero_results_partial
            ON search_events (created_at DESC, query)
            WHERE event_type = 'search' AND result_count = 0
        """)
        # Composite for top-searches admin query
        _pg_try(conn, """
            CREATE INDEX IF NOT EXISTS idx_search_events_search_partial
            ON search_events (created_at DESC, query)
            WHERE event_type = 'search'
        """)
        # Composite for click-through-rate per query
        _pg_try(conn, """
            CREATE INDEX IF NOT EXISTS idx_search_events_click_partial
            ON search_events (created_at DESC, query)
            WHERE event_type = 'click'
        """)

        # updated_at trigger function (wrapped: CREATE FUNCTION must never be
        # allowed to abort the whole migration transaction — that would roll
        # back the self-heal drop below and leave the bad trigger in place).
        _pg_try(conn, """
            CREATE OR REPLACE FUNCTION update_updated_at()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = NOW();
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
        """)
        # NOTE: a BEFORE-UPDATE trigger that sets NEW.updated_at only works on
        # tables that HAVE an updated_at column. Postgres doesn't validate the
        # column at CREATE TRIGGER time — only when the trigger fires — so a
        # trigger on a column-less table (e.g. `users`) silently breaks the
        # FIRST update of any row ("record new has no field updated_at").
        #
        # Self-heal: drop EVERY trigger that calls update_updated_at() on each
        # candidate table — discovered from the catalog, so it works regardless
        # of the trigger's name (covers triggers created manually / by older
        # code under a different name). Then (re)create the conventional
        # trigger only where the updated_at column actually exists.
        #
        # CRITICAL: every catalog/column lookup below is pinned to the `public`
        # schema. On Supabase the `auth` schema also has a `users` table — and
        # `auth.users` HAS an `updated_at` column. An unqualified
        # `information_schema.columns WHERE table_name='users'` therefore reports
        # the column as present, causing this code to (re)create the trigger on
        # `public.users` on every boot — which is exactly the bug that made the
        # "record new has no field updated_at" 500 keep coming back after a
        # manual drop. Qualifying with table_schema='public' fixes it for good.
        for tbl in ["users", "profiles", "listings", "prices"]:
            stale = conn.execute(text("""
                SELECT tg.tgname
                FROM pg_trigger   tg
                JOIN pg_class     c ON c.oid = tg.tgrelid
                JOIN pg_namespace n ON n.oid = c.relnamespace
                JOIN pg_proc      p ON p.oid = tg.tgfoid
                WHERE n.nspname = 'public'
                  AND c.relname = :tbl
                  AND p.proname = 'update_updated_at'
                  AND NOT tg.tgisinternal
            """), {"tbl": tbl}).fetchall()
            for (tgname,) in stale:
                _pg_try(conn, f'DROP TRIGGER IF EXISTS "{tgname}" ON public.{tbl}')
            # Belt-and-braces: also drop the conventional name in case the
            # catalog lookup missed it (e.g. function recreated/renamed).
            _pg_try(conn, f"DROP TRIGGER IF EXISTS {tbl}_updated_at ON public.{tbl}")

            has_col = conn.execute(text("""
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = :tbl
                  AND column_name = 'updated_at'
            """), {"tbl": tbl}).first()
            if not has_col:
                continue
            _pg_try(conn, f"""
                CREATE TRIGGER {tbl}_updated_at
                BEFORE UPDATE ON public.{tbl}
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

        # ── Block 3: FTS5 virtual table — porter stemmer + all searchable cols ──
        # The pre-existing prices_fts had only (name, description, retailer,
        # location) with no tokenizer. We upgrade to include brand, subcategory,
        # and condition, and add the porter+unicode61 tokenizer so queries like
        # "running" match "ran" and "café" matches "cafe". FTS5 virtual tables
        # cannot be ALTER'd, so we check the stored CREATE SQL via sqlite_master
        # and rebuild only when the schema is stale — keeps startup fast on the
        # already-migrated case.
        existing = conn.execute(text("""
            SELECT sql FROM sqlite_master
            WHERE type = 'table' AND name = 'prices_fts'
        """)).fetchone()

        stale = (
            existing is None
            or "condition" not in (existing[0] or "").lower()
            or "porter" not in (existing[0] or "").lower()
        )

        if stale:
            # Old triggers reference the legacy column list — drop them too.
            conn.execute(text("DROP TRIGGER IF EXISTS prices_fts_insert"))
            conn.execute(text("DROP TRIGGER IF EXISTS prices_fts_update"))
            conn.execute(text("DROP TRIGGER IF EXISTS prices_fts_delete"))
            conn.execute(text("DROP TABLE IF EXISTS prices_fts"))

            conn.execute(text("""
                CREATE VIRTUAL TABLE prices_fts USING fts5(
                    name, description, brand, subcategory,
                    condition, retailer, location,
                    content='prices', content_rowid='id',
                    tokenize='porter unicode61'
                )
            """))

            conn.execute(text("""
                CREATE TRIGGER prices_fts_insert
                AFTER INSERT ON prices BEGIN
                    INSERT INTO prices_fts(
                        rowid, name, description, brand, subcategory,
                        condition, retailer, location
                    ) VALUES (
                        new.id, new.name, new.description,
                        new.brand, new.subcategory,
                        new.condition, new.retailer, new.location
                    );
                END
            """))
            conn.execute(text("""
                CREATE TRIGGER prices_fts_update
                AFTER UPDATE ON prices BEGIN
                    INSERT INTO prices_fts(
                        prices_fts, rowid, name, description, brand,
                        subcategory, condition, retailer, location
                    ) VALUES (
                        'delete', old.id, old.name, old.description,
                        old.brand, old.subcategory, old.condition,
                        old.retailer, old.location
                    );
                    INSERT INTO prices_fts(
                        rowid, name, description, brand, subcategory,
                        condition, retailer, location
                    ) VALUES (
                        new.id, new.name, new.description,
                        new.brand, new.subcategory,
                        new.condition, new.retailer, new.location
                    );
                END
            """))
            conn.execute(text("""
                CREATE TRIGGER prices_fts_delete
                AFTER DELETE ON prices BEGIN
                    INSERT INTO prices_fts(
                        prices_fts, rowid, name, description, brand,
                        subcategory, condition, retailer, location
                    ) VALUES (
                        'delete', old.id, old.name, old.description,
                        old.brand, old.subcategory, old.condition,
                        old.retailer, old.location
                    );
                END
            """))

            # Backfill existing rows into the freshly-built FTS index.
            conn.execute(text("""
                INSERT INTO prices_fts(
                    rowid, name, description, brand, subcategory,
                    condition, retailer, location
                )
                SELECT id, name, description, brand, subcategory,
                       condition, retailer, location
                FROM prices
            """))
        # ── End Block 3 ───────────────────────────────────────────────────────

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
    Idempotent SQLite-specific table creations, indexes, and one-shot data
    backfills. Column additions live in ``app/migrations/runner.py`` — that
    is the canonical place to register a new column for *both* dialects.
    """
    with eng.connect() as conn:
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
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_reviews_listing_id ON reviews(listing_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_reviews_seller_id ON reviews(seller_id)"))

        # UUID column creation + UNIQUE indexes + the UUID/email_verified
        # backfills moved to app/migrations/runner.py — they must run *after*
        # the cross-dialect ADD COLUMN pass.

        conn.commit()


def _sqlite_add_column(conn, table: str, column: str, definition: str) -> None:
    """Add a column to a SQLite table, silently skip if it already exists."""
    try:
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {definition}"))
        conn.commit()
    except Exception:
        pass
