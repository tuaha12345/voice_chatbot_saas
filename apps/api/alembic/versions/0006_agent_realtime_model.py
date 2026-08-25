"""agent realtime model

Revision ID: 0006_agent_realtime_model
Revises: 0005_ai_usage
Create Date: 2026-08-22
"""

from alembic import op
import sqlalchemy as sa

revision = "0006_agent_realtime_model"
down_revision = "0005_ai_usage"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "agents",
        sa.Column(
            "realtime_model",
            sa.String(128),
            server_default="gpt-4o-realtime-preview",
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("agents", "realtime_model")
