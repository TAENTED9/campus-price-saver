"""
alembic/env.py — Alembic migration environment (Block 14B).

Reads DATABASE_URL from environment. Supports both SQLite (local dev) and
PostgreSQL (Supabase prod). SQLite uses non-transactional DDL mode.
"""
import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from dotenv import load_dotenv

from alembic import context

load_dotenv()

# Alembic Config object — gives access to values in alembic.ini
config = context.config

# Set up Python logging from alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Import ALL models so Alembic can autogenerate migrations
from app.database import Base  # noqa: E402
import app.models  # noqa: E402, F401 — side-effect import registers all models

target_metadata = Base.metadata

# Override sqlalchemy.url from environment
DATABASE_URL = os.getenv("DATABASE_URL") or "sqlite:///./data.db"
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)

config.set_main_option("sqlalchemy.url", DATABASE_URL)

IS_SQLITE = DATABASE_URL.startswith("sqlite")


def run_migrations_offline() -> None:
    """
    Run migrations in 'offline' mode — no live DB connection needed.
    Emits SQL to stdout (useful for reviewing before applying).
    """
    context.configure(
        url=DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=IS_SQLITE,  # SQLite requires batch mode for ALTER TABLE
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations with a live DB connection."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=IS_SQLITE,  # SQLite requires batch mode for ALTER TABLE
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
