"""Add paused_by_vacation flag to prices, ensure notif_email_weekly_digest on user_settings

Revision ID: 006_vacation_and_weekly_digest
Revises: 005_profile_policy_fields
Create Date: 2026-05-18 00:00:00.000000

Why:
  Block 1's Celery scheduled tasks need a precise way to identify
  vacation-paused listings (vs sellers manually pausing) and a typed
  notification preference for the weekly seller digest opt-out.

This migration is idempotent — it inspects the live schema and only
adds columns that aren't already present. Older dev databases created
by init_db() may already have notif_email_weekly_digest from the model.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "006_vacation_and_weekly_digest"
down_revision = "005_profile_policy_fields"
branch_labels = None
depends_on = None


def _existing_columns(table: str) -> set[str]:
    bind = op.get_bind()
    insp = inspect(bind)
    try:
        return {c["name"] for c in insp.get_columns(table)}
    except Exception:
        return set()


def upgrade() -> None:
    # ── prices.paused_by_vacation ──────────────────────────────────────────
    prices_cols = _existing_columns("prices")
    if "paused_by_vacation" not in prices_cols:
        with op.batch_alter_table("prices") as batch_op:
            batch_op.add_column(
                sa.Column(
                    "paused_by_vacation",
                    sa.Boolean(),
                    nullable=False,
                    server_default=sa.false(),
                )
            )

    # ── user_settings.notif_email_weekly_digest ────────────────────────────
    settings_cols = _existing_columns("user_settings")
    if "notif_email_weekly_digest" not in settings_cols:
        with op.batch_alter_table("user_settings") as batch_op:
            batch_op.add_column(
                sa.Column(
                    "notif_email_weekly_digest",
                    sa.Boolean(),
                    nullable=False,
                    server_default=sa.true(),
                )
            )


def downgrade() -> None:
    settings_cols = _existing_columns("user_settings")
    if "notif_email_weekly_digest" in settings_cols:
        with op.batch_alter_table("user_settings") as batch_op:
            batch_op.drop_column("notif_email_weekly_digest")

    prices_cols = _existing_columns("prices")
    if "paused_by_vacation" in prices_cols:
        with op.batch_alter_table("prices") as batch_op:
            batch_op.drop_column("paused_by_vacation")
