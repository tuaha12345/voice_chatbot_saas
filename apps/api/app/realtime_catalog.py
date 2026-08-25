from __future__ import annotations

REALTIME_PROVIDER = {"id": "openai", "label": "OpenAI Realtime"}

REALTIME_MODELS: list[dict[str, str]] = [
    {
        "id": "gpt-realtime-2.1",
        "label": "gpt-realtime-2.1",
        "hint": "recommended, ~$0.08/min",
    },
    {
        "id": "gpt-realtime",
        "label": "gpt-realtime",
        "hint": "standard, ~$0.08/min",
    },
    {
        "id": "gpt-realtime-mini",
        "label": "gpt-realtime-mini",
        "hint": "lower cost, ~$0.03/min",
    },
    {
        "id": "gpt-4o-realtime-preview",
        "label": "gpt-4o-realtime-preview",
        "hint": "legacy",
    },
]

REALTIME_VOICES: list[dict[str, str]] = [
    {"id": "alloy", "label": "Alloy (Neutral, balanced)"},
    {"id": "ash", "label": "Ash (Male, warm)"},
    {"id": "ballad", "label": "Ballad (Male, deep)"},
    {"id": "cedar", "label": "Cedar (Male, natural)"},
    {"id": "coral", "label": "Coral (Female, clear)"},
    {"id": "echo", "label": "Echo (Male, crisp)"},
    {"id": "marin", "label": "Marin (Female, natural)"},
    {"id": "sage", "label": "Sage (Female, calm)"},
    {"id": "shimmer", "label": "Shimmer (Female, bright)"},
    {"id": "verse", "label": "Verse (Male, smooth)"},
]

MODEL_IDS = {m["id"] for m in REALTIME_MODELS}
VOICE_IDS = {v["id"] for v in REALTIME_VOICES}


def is_valid_model(model: str) -> bool:
    return (model or "").strip() in MODEL_IDS


def is_valid_voice(voice: str) -> bool:
    return (voice or "").strip() in VOICE_IDS
