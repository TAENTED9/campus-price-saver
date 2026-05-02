"""Add pickup_policy, return_policy, payment_policy columns to profiles

Revision ID: 005_profile_policy_fields
Revises: 004_review_edit_images
Create Date: 2025-06-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "005_profile_policy_fields"
down_revision = "004_review_edit_images"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("profiles") as batch_op:
        batch_op.add_column(sa.Column("pickup_policy",  sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("return_policy",  sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("payment_policy", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("profiles") as batch_op:
        batch_op.drop_column("payment_policy")
        batch_op.drop_column("return_policy")
        batch_op.drop_column("pickup_policy")
