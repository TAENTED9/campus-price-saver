"""Add is_edited, edited_at columns to reviews

Revision ID: 004_review_edit_images
Revises: 003_remember_me_and_saved_price
Create Date: 2025-06-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "004_review_edit_images"
down_revision = "003_remember_me_and_saved_price"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("reviews") as batch_op:
        batch_op.add_column(sa.Column("is_edited", sa.Boolean(), nullable=True, server_default=sa.text("0")))
        batch_op.add_column(sa.Column("edited_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("reviews") as batch_op:
        batch_op.drop_column("edited_at")
        batch_op.drop_column("is_edited")
