"""agent site pages JSON

Revision ID: 0008_agent_site_pages
Revises: 0007_agent_character
Create Date: 2026-08-24
"""

from alembic import op
import sqlalchemy as sa

revision = "0008_agent_site_pages"
down_revision = "0007_agent_character"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "agents",
        sa.Column("site_pages", sa.Text(), server_default="[]", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("agents", "site_pages")
