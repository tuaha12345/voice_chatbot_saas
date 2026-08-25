"""notify catalog usage

Revision ID: 0003_notify
Revises: 0002_modules
Create Date: 2026-08-19
"""

from alembic import op
import sqlalchemy as sa

revision = "0003_notify"
down_revision = "0002_modules"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("plan_minutes", sa.Integer(), server_default="120"))
    op.create_table(
        "agent_webhooks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("agent_id", sa.Integer(), sa.ForeignKey("agents.id"), nullable=False),
        sa.Column("url", sa.String(500), server_default=""),
        sa.Column("secret", sa.String(128), server_default=""),
    )
    op.create_index("ix_agent_webhooks_agent_id", "agent_webhooks", ["agent_id"], unique=True)
    op.create_table(
        "products",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("agent_id", sa.Integer(), sa.ForeignKey("agents.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("sku", sa.String(64), server_default=""),
        sa.Column("price", sa.Float(), server_default="0"),
        sa.Column("active", sa.Boolean(), server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_products_agent_id", "products", ["agent_id"])


def downgrade() -> None:
    op.drop_table("products")
    op.drop_table("agent_webhooks")
    op.drop_column("users", "plan_minutes")
