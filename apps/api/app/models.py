from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    plan_minutes: Mapped[int] = mapped_column(Integer, default=120)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    agents: Mapped[list["Agent"]] = relationship(back_populates="user")


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    language: Mapped[str] = mapped_column(String(16), default="en")
    voice: Mapped[str] = mapped_column(String(64), default="alloy")
    realtime_model: Mapped[str] = mapped_column(String(128), default="gpt-4o-realtime-preview")
    system_prompt: Mapped[str] = mapped_column(
        Text,
        default="You are a helpful voice assistant. Answer only from the provided knowledge base.",
    )
    public_key: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    secret_hash: Mapped[str] = mapped_column(String(255))
    allowed_origins: Mapped[str] = mapped_column(Text, default="")
    max_call_minutes: Mapped[int] = mapped_column(Integer, default=10)
    character_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    character_pack: Mapped[str] = mapped_column(String(64), default="character_emoji")
    launcher_mode: Mapped[str] = mapped_column(String(16), default="mic")
    launcher_skin: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, default=None)
    launcher_label: Mapped[str] = mapped_column(String(80), default="Tap to talk with AI")
    launcher_color: Mapped[str] = mapped_column(String(16), default="#2563eb")
    launcher_size: Mapped[int] = mapped_column(Integer, default=160)
    character_size: Mapped[int] = mapped_column(Integer, default=200)
    panel_width: Mapped[int] = mapped_column(Integer, default=280)
    show_transcription: Mapped[bool] = mapped_column(Boolean, default=False)
    site_pages: Mapped[str] = mapped_column(Text, default="[]")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="agents")
    modules: Mapped["AgentModule"] = relationship(back_populates="agent", uselist=False)
    knowledge_docs: Mapped[list["KnowledgeDoc"]] = relationship(back_populates="agent")
    conversations: Mapped[list["Conversation"]] = relationship(back_populates="agent")
    booking_settings: Mapped[Optional["BookingSettings"]] = relationship(
        back_populates="agent", uselist=False
    )
    bookings: Mapped[list["Booking"]] = relationship(back_populates="agent")
    orders: Mapped[list["Order"]] = relationship(back_populates="agent")
    tickets: Mapped[list["Ticket"]] = relationship(back_populates="agent")
    webhook: Mapped[Optional["AgentWebhook"]] = relationship(back_populates="agent", uselist=False)
    products: Mapped[list["Product"]] = relationship(back_populates="agent")


class AgentModule(Base):
    __tablename__ = "agent_modules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"), unique=True)
    qa: Mapped[bool] = mapped_column(Boolean, default=True)
    support: Mapped[bool] = mapped_column(Boolean, default=False)
    booking: Mapped[bool] = mapped_column(Boolean, default=False)
    orders: Mapped[bool] = mapped_column(Boolean, default=False)

    agent: Mapped["Agent"] = relationship(back_populates="modules")


class KnowledgeDoc(Base):
    __tablename__ = "knowledge_docs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    agent: Mapped["Agent"] = relationship(back_populates="knowledge_docs")


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"), index=True)
    room_name: Mapped[str] = mapped_column(String(128), index=True)
    visitor_identity: Mapped[str] = mapped_column(String(128), default="visitor")
    started_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    agent: Mapped["Agent"] = relationship(back_populates="conversations")
    messages: Mapped[list["Message"]] = relationship(back_populates="conversation")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.id"), index=True)
    role: Mapped[str] = mapped_column(String(32))
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    conversation: Mapped["Conversation"] = relationship(back_populates="messages")


class UsageEvent(Base):
    __tablename__ = "usage_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"), index=True)
    minutes: Mapped[float] = mapped_column(Float, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class AiUsageEvent(Base):
    __tablename__ = "ai_usage_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"), index=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True, default=0)
    room_name: Mapped[str] = mapped_column(String(128), default="")
    model: Mapped[str] = mapped_column(String(128), default="")
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    audio_input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    audio_output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    minutes: Mapped[float] = mapped_column(Float, default=0)
    cost_usd: Mapped[float] = mapped_column(Float, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class BookingSettings(Base):
    __tablename__ = "booking_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"), unique=True)
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Dhaka")
    slot_minutes: Mapped[int] = mapped_column(Integer, default=30)
    open_hour: Mapped[int] = mapped_column(Integer, default=9)
    close_hour: Mapped[int] = mapped_column(Integer, default=17)
    weekdays: Mapped[str] = mapped_column(String(32), default="1,2,3,4,5")
    max_days_ahead: Mapped[int] = mapped_column(Integer, default=14)

    agent: Mapped["Agent"] = relationship(back_populates="booking_settings")


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"), index=True)
    starts_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime)
    guest_name: Mapped[str] = mapped_column(String(120))
    guest_phone: Mapped[str] = mapped_column(String(40), default="")
    guest_email: Mapped[str] = mapped_column(String(255), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(32), default="confirmed")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    agent: Mapped["Agent"] = relationship(back_populates="bookings")


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"), index=True)
    customer_name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(40), default="")
    address: Mapped[str] = mapped_column(Text, default="")
    items: Mapped[str] = mapped_column(Text)
    notes: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(32), default="new")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    agent: Mapped["Agent"] = relationship(back_populates="orders")


class Ticket(Base):
    __tablename__ = "tickets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"), index=True)
    visitor_name: Mapped[str] = mapped_column(String(120), default="")
    phone: Mapped[str] = mapped_column(String(40), default="")
    email: Mapped[str] = mapped_column(String(255), default="")
    subject: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="open")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    agent: Mapped["Agent"] = relationship(back_populates="tickets")


class AgentWebhook(Base):
    __tablename__ = "agent_webhooks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"), unique=True)
    url: Mapped[str] = mapped_column(String(500), default="")
    secret: Mapped[str] = mapped_column(String(128), default="")

    agent: Mapped["Agent"] = relationship(back_populates="webhook")


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    sku: Mapped[str] = mapped_column(String(64), default="")
    price: Mapped[float] = mapped_column(Float, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    agent: Mapped["Agent"] = relationship(back_populates="products")
