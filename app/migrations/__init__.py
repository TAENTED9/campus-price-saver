"""Idempotent runtime database migrations.

See ``app/migrations/runner.py`` — that is the single entry point. Every
process (web, celery worker, celery beat) calls ``run_all_migrations()`` at
startup so no caller ever queries a column that hasn't been created yet.
"""

from app.migrations.runner import COLUMN_MIGRATIONS, run_all_migrations

__all__ = ["COLUMN_MIGRATIONS", "run_all_migrations"]
