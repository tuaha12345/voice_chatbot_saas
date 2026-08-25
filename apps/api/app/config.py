from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(ROOT_DIR / ".env"), ".env"),
        extra="ignore",
    )

    database_url: str = "mysql+pymysql://root@localhost:3306/voice_chat"
    jwt_secret: str = "change-me-to-a-long-random-string"
    jwt_expire_minutes: int = 10080
    api_public_url: str = "http://localhost:8000"
    web_origin: str = "http://localhost:3000"
    internal_agent_secret: str = "change-me-internal-agent-secret"
    livekit_url: str = ""
    livekit_api_key: str = ""
    livekit_api_secret: str = ""
    agent_name: str = "voice-qa"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    default_plan_minutes: int = 120
    admin_email: str = ""
    admin_password: str = ""
    openai_realtime_model: str = "gpt-4o-realtime-preview"
    # Admin API key for OpenAI Costs API (platform.openai.com → Admin keys)
    openai_admin_api_key: str = ""
    openai_api_key: str = ""
    # USD per 1M tokens (OpenAI realtime ballpark — editable in .env)
    openai_price_input_per_1m: float = 5.0
    openai_price_output_per_1m: float = 20.0
    openai_price_audio_input_per_1m: float = 100.0
    openai_price_audio_output_per_1m: float = 200.0


settings = Settings()


def estimate_ai_cost_usd(
    input_tokens: int = 0,
    output_tokens: int = 0,
    audio_input_tokens: int = 0,
    audio_output_tokens: int = 0,
) -> float:
    """Estimate USD cost from token counts using configured rates."""
    cost = 0.0
    cost += (input_tokens / 1_000_000.0) * settings.openai_price_input_per_1m
    cost += (output_tokens / 1_000_000.0) * settings.openai_price_output_per_1m
    cost += (audio_input_tokens / 1_000_000.0) * settings.openai_price_audio_input_per_1m
    cost += (audio_output_tokens / 1_000_000.0) * settings.openai_price_audio_output_per_1m
    return round(cost, 6)
