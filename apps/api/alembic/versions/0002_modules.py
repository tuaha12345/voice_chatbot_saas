"""booking orders tickets

Revision ID: 0002_modules
Revises: 0001_initial
Create Date: 2026-08-19
"""

from alembic import op
import sqlalchemy as sa

revision = "0002_modules"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "booking_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("agent_id", sa.Integer(), sa.ForeignKey("agents.id"), nullable=False),
        sa.Column("timezone", sa.String(64), server_default="Asia/Dhaka"),
        sa.Column("slot_minutes", sa.Integer(), server_default="30"),
        sa.Column("open_hour", sa.Integer(), server_default="9"),
        sa.Column("close_hour", sa.Integer(), server_default="17"),
        sa.Column("weekdays", sa.String(32), server_default="1,2,3,4,5"),
        sa.Column("max_days_ahead", sa.Integer(), server_default="14"),
    )
    op.create_index("ix_booking_settings_agent_id", "booking_settings", ["agent_id"], unique=True)

    op.create_table(
        "bookings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("agent_id", sa.Integer(), sa.ForeignKey("agents.id"), nullable=False),
        sa.Column("starts_at", sa.DateTime(), nullable=False),
        sa.Column("ends_at", sa.DateTime(), nullable=False),
        sa.Column("guest_name", sa.String(120), nullable=False),
        sa.Column("guest_phone", sa.String(40), server_default=""),
        sa.Column("guest_email", sa.String(255), server_default=""),
        sa.Column("notes", sa.Text(), server_default=""),
        sa.Column("status", sa.String(32), server_default="confirmed"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_bookings_agent_id", "bookings", ["agent_id"])
    op.create_index("ix_bookings_starts_at", "bookings", ["starts_at"])

    op.create_table(
        "orders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("agent_id", sa.Integer(), sa.ForeignKey("agents.id"), nullable=False),
        sa.Column("customer_name", sa.String(120), nullable=False),
        sa.Column("phone", sa.String(40), server_default=""),
        sa.Column("address", sa.Text(), server_default=""),
        sa.Column("items", sa.Text(), nullable=False),
        sa.Column("notes", sa.Text(), server_default=""),
        sa.Column("status", sa.String(32), server_default="new"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_orders_agent_id", "orders", ["agent_id"])

    op.create_table(
        "tickets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("agent_id", sa.Integer(), sa.ForeignKey("agents.id"), nullable=False),
        sa.Column("visitor_name", sa.String(120), server_default=""),
        sa.Column("phone", sa.String(40), server_default=""),
        sa.Column("email", sa.String(255), server_default=""),
        sa.Column("subject", sa.String(255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("status", sa.String(32), server_default="open"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_tickets_agent_id", "tickets", ["agent_id"])


def downgrade() -> None:
    op.drop_table("tickets")
    op.drop_table("orders")
    op.drop_table("bookings")
    op.drop_table("booking_settings")
