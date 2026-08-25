"""agent character emoji

Revision ID: 0007_agent_character
Revises: 0006_agent_realtime_model
Create Date: 2026-08-24
"""

from alembic import op
import sqlalchemy as sa

revision = "0007_agent_character"
down_revision = "0006_agent_realtime_model"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "agents",
        sa.Column("character_enabled", sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    op.add_column(
        "agents",
        sa.Column(
            "character_pack",
            sa.String(64),
            server_default="character_emoji",
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("agents", "character_pack")
    op.drop_column("agents", "character_enabled")
