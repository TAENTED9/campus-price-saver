"""add karma_ledger table

Revision ID: 001_add_karma_ledger
Revises:
Create Date: 2025-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "001_add_karma_ledger"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "karma_ledger",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("seller_id", sa.Integer(), nullable=False),
        sa.Column("points", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(length=100), nullable=False),
        sa.Column("reference_id", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["seller_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_karma_ledger_id"), "karma_ledger", ["id"], unique=False)
    op.create_index(op.f("ix_karma_ledger_seller_id"), "karma_ledger", ["seller_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_karma_ledger_seller_id"), table_name="karma_ledger")
    op.drop_index(op.f("ix_karma_ledger_id"), table_name="karma_ledger")
    op.drop_table("karma_ledger")
