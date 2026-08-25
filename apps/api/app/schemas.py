from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    email: str
    plan_minutes: Optional[int] = 120
    is_admin: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminStatsOut(BaseModel):
    users_count: int
    agents_count: int
    usage_minutes_month: float
    model: str = ""
    input_tokens_month: int = 0
    output_tokens_month: int = 0
    audio_input_tokens_month: int = 0
    audio_output_tokens_month: int = 0
    cost_usd_month: float = 0.0
    calls_month: int = 0


class OpenAiCostLineItemOut(BaseModel):
    line_item: str
    cost_usd: float


class OpenAiOrgCostsOut(BaseModel):
    ok: bool
    cost_usd: float = 0.0
    currency: str = "usd"
    line_items: list[OpenAiCostLineItemOut] = []
    period_start: str | None = None
    period_end: str | None = None
    error: str | None = None


class AdminUsageOut(BaseModel):
    id: int
    created_at: datetime
    user_email: str
    agent_name: str
    agent_id: int
    room_name: str
    model: str
    input_tokens: int
    output_tokens: int
    audio_input_tokens: int
    audio_output_tokens: int
    minutes: float
    cost_usd: float


class AdminUsageSummaryOut(BaseModel):
    user_id: int
    user_email: str
    calls: int
    minutes: float
    input_tokens: int
    output_tokens: int
    audio_input_tokens: int
    audio_output_tokens: int
    cost_usd: float


class AiUsageIn(BaseModel):
    room_name: str = ""
    model: str = ""
    input_tokens: int = 0
    output_tokens: int = 0
    audio_input_tokens: int = 0
    audio_output_tokens: int = 0
    minutes: float = 0


class AdminUserOut(BaseModel):
    id: int
    email: str
    plan_minutes: Optional[int] = 120
    is_admin: bool
    agent_count: int
    used_minutes: float
    cost_usd_month: float = 0.0
    created_at: datetime


class AdminUserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(default=None, min_length=6)
    plan_minutes: Optional[int] = Field(default=None, ge=0)
    is_admin: Optional[bool] = None


class AdminAgentOut(BaseModel):
    id: int
    name: str
    user_id: int
    user_email: str
    public_key: str
    voice: str
    realtime_model: str
    character_enabled: bool = False
    character_pack: str = "character_emoji"
    created_at: datetime


class AdminAgentUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    voice: Optional[str] = None
    realtime_model: Optional[str] = None
    character_enabled: Optional[bool] = None
    character_pack: Optional[str] = None


class CharacterPackOut(BaseModel):
    id: str
    label: str


class RealtimeOptionsOut(BaseModel):
    provider: dict
    models: list[dict]
    voices: list[dict]


class ModulesIn(BaseModel):
    qa: bool = True
    support: bool = False
    booking: bool = False
    orders: bool = False


class ModulesOut(BaseModel):
    qa: bool
    support: bool
    booking: bool
    orders: bool

    model_config = {"from_attributes": True}


class AgentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    language: str = "en"
    voice: str = "alloy"
    system_prompt: str | None = None
    allowed_origins: str = "*"


class AgentUpdate(BaseModel):
    name: str | None = None
    language: str | None = None
    voice: str | None = None
    system_prompt: str | None = None
    allowed_origins: str | None = None
    modules: ModulesIn | None = None


class AgentOut(BaseModel):
    id: int
    name: str
    language: str
    voice: str
    realtime_model: str = "gpt-4o-realtime-preview"
    system_prompt: str
    public_key: str
    allowed_origins: str
    created_at: datetime
    modules: ModulesOut | None = None

    model_config = {"from_attributes": True}


class AgentCreatedOut(AgentOut):
    secret: str | None = None


class KnowledgeIn(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    body: str = Field(min_length=1)


class KnowledgeOut(BaseModel):
    id: int
    agent_id: int
    title: str
    body: str
    created_at: datetime

    model_config = {"from_attributes": True}


class MessageOut(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationOut(BaseModel):
    id: int
    agent_id: int
    room_name: str
    visitor_identity: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    messages: list[MessageOut] = []

    model_config = {"from_attributes": True}


class WidgetSessionIn(BaseModel):
    public_key: str
    origin: str | None = None


class CharacterStatesOut(BaseModel):
    welcome: list[str] = []
    listening: list[str] = []
    speaking: list[str] = []
    bye: list[str] = []


class CharacterOut(BaseModel):
    enabled: bool
    pack: str
    base_url: str
    states: CharacterStatesOut


class WidgetSessionOut(BaseModel):
    livekit_url: str
    token: str
    room_name: str
    agent_name: str
    voice_enabled: bool
    message: str | None = None
    character: CharacterOut | None = None


class ConversationSaveIn(BaseModel):
    room_name: str
    visitor_identity: str = "visitor"
    messages: list[dict]
    minutes: float = 0


class BookingSettingsIn(BaseModel):
    timezone: str = "Asia/Dhaka"
    slot_minutes: int = Field(default=30, ge=10, le=240)
    open_hour: int = Field(default=9, ge=0, le=23)
    close_hour: int = Field(default=17, ge=1, le=24)
    weekdays: str = "1,2,3,4,5"
    max_days_ahead: int = Field(default=14, ge=1, le=90)


class BookingSettingsOut(BookingSettingsIn):
    agent_id: int

    model_config = {"from_attributes": True}


class BookingCreate(BaseModel):
    guest_name: str = Field(min_length=1, max_length=120)
    guest_phone: str = ""
    guest_email: str = ""
    notes: str = ""
    starts_at: str


class BookingOut(BaseModel):
    id: int
    agent_id: int
    starts_at: datetime
    ends_at: datetime
    guest_name: str
    guest_phone: str
    guest_email: str
    notes: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class OrderCreate(BaseModel):
    customer_name: str = Field(min_length=1, max_length=120)
    phone: str = ""
    address: str = ""
    items: str = Field(min_length=1)
    notes: str = ""


class OrderOut(BaseModel):
    id: int
    agent_id: int
    customer_name: str
    phone: str
    address: str
    items: str
    notes: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class OrderStatusIn(BaseModel):
    status: str


class TicketCreate(BaseModel):
    visitor_name: str = ""
    phone: str = ""
    email: str = ""
    subject: str = Field(min_length=1, max_length=255)
    body: str = Field(min_length=1)


class TicketOut(BaseModel):
    id: int
    agent_id: int
    visitor_name: str
    phone: str
    email: str
    subject: str
    body: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TicketStatusIn(BaseModel):
    status: str


class WebhookIn(BaseModel):
    url: str = ""


class WebhookOut(BaseModel):
    url: str
    secret: str
    has_secret: bool = True

    model_config = {"from_attributes": True}


class ProductIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    sku: str = ""
    price: float = 0
    active: bool = True


class ProductOut(BaseModel):
    id: int
    agent_id: int
    name: str
    sku: str
    price: float
    active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class SitePageIn(BaseModel):
    key: str = Field(min_length=1, max_length=40)
    label: str = Field(min_length=1, max_length=120)
    path: str = Field(min_length=1, max_length=500)


class SitePagesIn(BaseModel):
    pages: list[SitePageIn] = Field(default_factory=list, max_length=20)


class SitePageOut(BaseModel):
    key: str
    label: str
    path: str


class SitePagesOut(BaseModel):
    pages: list[SitePageOut] = []


class ModelUsageOut(BaseModel):
    model: str
    calls: int
    minutes: float
    input_tokens: int
    output_tokens: int
    audio_input_tokens: int
    audio_output_tokens: int
    cost_usd: float


class UsageOut(BaseModel):
    used_minutes: float
    plan_minutes: int
    remaining_minutes: float
    calls_month: int = 0
    cost_usd_month: float = 0.0
    input_tokens_month: int = 0
    output_tokens_month: int = 0
    audio_input_tokens_month: int = 0
    audio_output_tokens_month: int = 0
    by_model: list[ModelUsageOut] = []


