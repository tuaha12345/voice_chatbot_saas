"""ai usage events

Revision ID: 0005_ai_usage
Revises: 0004_admin
Create Date: 2026-08-21
"""

from alembic import op
import sqlalchemy as sa

revision = "0005_ai_usage"
down_revision = "0004_admin"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_usage_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("agent_id", sa.Integer(), sa.ForeignKey("agents.id"), nullable=False),
        sa.Column("user_id", sa.Integer(), server_default="0"),
        sa.Column("room_name", sa.String(128), server_default=""),
        sa.Column("model", sa.String(128), server_default=""),
        sa.Column("input_tokens", sa.Integer(), server_default="0"),
        sa.Column("output_tokens", sa.Integer(), server_default="0"),
        sa.Column("audio_input_tokens", sa.Integer(), server_default="0"),
        sa.Column("audio_output_tokens", sa.Integer(), server_default="0"),
        sa.Column("minutes", sa.Float(), server_default="0"),
        sa.Column("cost_usd", sa.Float(), server_default="0"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_ai_usage_events_agent_id", "ai_usage_events", ["agent_id"])
    op.create_index("ix_ai_usage_events_user_id", "ai_usage_events", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_ai_usage_events_user_id", "ai_usage_events")
    op.drop_index("ix_ai_usage_events_agent_id", "ai_usage_events")
    op.drop_table("ai_usage_events")
