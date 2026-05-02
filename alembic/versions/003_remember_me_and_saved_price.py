"""add remember_me to refresh_tokens and saved_price to wishlists

Revision ID: 003_remember_me_and_saved_price
Revises: 002_karma_ledger_unique
Create Date: 2025-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "003_remember_me_and_saved_price"
down_revision = "002_karma_ledger_unique"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # FIND-27: store remember_me preference on refresh tokens
    op.add_column(
        "refresh_tokens",
        sa.Column("remember_me", sa.Boolean(), nullable=False, server_default="false"),
    )
    # BUG-008: store listing price at time of wishlist save
    op.add_column(
        "wishlists",
        sa.Column("saved_price", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("wishlists", "saved_price")
    op.drop_column("refresh_tokens", "remember_me")
