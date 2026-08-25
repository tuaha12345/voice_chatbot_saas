"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-08-19
"""

from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "agents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("language", sa.String(16), server_default="en"),
        sa.Column("voice", sa.String(64), server_default="alloy"),
        sa.Column("system_prompt", sa.Text(), nullable=False),
        sa.Column("public_key", sa.String(64), nullable=False),
        sa.Column("secret_hash", sa.String(255), nullable=False),
        sa.Column("allowed_origins", sa.Text(), server_default="*"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_agents_public_key", "agents", ["public_key"], unique=True)
    op.create_index("ix_agents_user_id", "agents", ["user_id"])

    op.create_table(
        "agent_modules",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("agent_id", sa.Integer(), sa.ForeignKey("agents.id"), nullable=False),
        sa.Column("qa", sa.Boolean(), server_default=sa.true()),
        sa.Column("support", sa.Boolean(), server_default=sa.false()),
        sa.Column("booking", sa.Boolean(), server_default=sa.false()),
        sa.Column("orders", sa.Boolean(), server_default=sa.false()),
    )
    op.create_index("ix_agent_modules_agent_id", "agent_modules", ["agent_id"], unique=True)

    op.create_table(
        "knowledge_docs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("agent_id", sa.Integer(), sa.ForeignKey("agents.id"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_knowledge_docs_agent_id", "knowledge_docs", ["agent_id"])

    op.create_table(
        "conversations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("agent_id", sa.Integer(), sa.ForeignKey("agents.id"), nullable=False),
        sa.Column("room_name", sa.String(128), nullable=False),
        sa.Column("visitor_identity", sa.String(128), server_default="visitor"),
        sa.Column("started_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("ended_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_conversations_agent_id", "conversations", ["agent_id"])

    op.create_table(
        "messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("conversation_id", sa.Integer(), sa.ForeignKey("conversations.id"), nullable=False),
        sa.Column("role", sa.String(32), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_messages_conversation_id", "messages", ["conversation_id"])

    op.create_table(
        "usage_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("agent_id", sa.Integer(), sa.ForeignKey("agents.id"), nullable=False),
        sa.Column("minutes", sa.Float(), server_default="0"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_usage_events_agent_id", "usage_events", ["agent_id"])


def downgrade() -> None:
    op.drop_table("usage_events")
    op.drop_table("messages")
    op.drop_table("conversations")
    op.drop_table("knowledge_docs")
    op.drop_table("agent_modules")
    op.drop_table("agents")
    op.drop_table("users")
