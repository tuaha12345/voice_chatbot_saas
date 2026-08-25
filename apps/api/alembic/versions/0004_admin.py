"""admin role

Revision ID: 0004_admin
Revises: 0003_notify
Create Date: 2026-08-20
"""

from alembic import op
import sqlalchemy as sa

revision = "0004_admin"
down_revision = "0003_notify"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_admin", sa.Boolean(), server_default="0"))


def downgrade() -> None:
    op.drop_column("users", "is_admin")
