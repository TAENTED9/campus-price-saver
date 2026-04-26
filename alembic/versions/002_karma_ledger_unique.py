"""add unique constraint and widen reference_id on karma_ledger

Revision ID: 002_karma_ledger_unique
Revises: 001_add_karma_ledger
Create Date: 2025-01-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "002_karma_ledger_unique"
down_revision = "001_add_karma_ledger"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("karma_ledger") as batch_op:
        batch_op.alter_column(
            "reference_id",
            existing_type=sa.String(length=100),
            type_=sa.String(length=200),
            existing_nullable=True,
        )
        batch_op.create_unique_constraint(
            "uq_karma_ledger_dedup",
            ["seller_id", "reason", "reference_id"],
        )


def downgrade() -> None:
    with op.batch_alter_table("karma_ledger") as batch_op:
        batch_op.drop_constraint("uq_karma_ledger_dedup", type_="unique")
        batch_op.alter_column(
            "reference_id",
            existing_type=sa.String(length=200),
            type_=sa.String(length=100),
            existing_nullable=True,
        )
