from __future__ import annotations

import json
import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.character_packs import build_character_payload
from app.launcher_skins import get_skin_payload
from app.models import Agent, User
from app.origin_security import origin_allowed, resolve_request_origin
from app.rate_limit import client_ip, widget_session_limiter
from app.schemas import (
    CharacterOut,
    CharacterStatesOut,
    LauncherSkinPayload,
    WidgetBootstrapOut,
    WidgetSessionIn,
    WidgetSessionOut,
)
from app.usage import plan_exhausted

router = APIRouter(prefix="/v1/widget", tags=["widget"])


def livekit_configured() -> bool:
    return bool(settings.livekit_url and settings.livekit_api_key and settings.livekit_api_secret)


def _max_call_minutes(agent: Agent) -> int:
    try:
        value = int(getattr(agent, "max_call_minutes", None) or 10)
    except (TypeError, ValueError):
        value = 10
    return max(1, min(value, 120))


def _character_for_agent(agent: Agent) -> CharacterOut | None:
    payload = build_character_payload(
        agent.character_pack or "character_emoji",
        bool(agent.character_enabled),
    )
    if not payload:
        return None
    states = payload["states"]
    return CharacterOut(
        enabled=True,
        pack=payload["pack"],
        base_url=payload["base_url"],
        states=CharacterStatesOut(
            welcome=states.get("welcome", []),
            listening=states.get("listening", []),
            speaking=states.get("speaking", []),
            bye=states.get("bye", []),
        ),
    )


def _character_size(agent: Agent) -> int:
    try:
        value = int(getattr(agent, "character_size", None) or 200)
    except (TypeError, ValueError):
        value = 200
    return max(120, min(value, 400))


def _launcher_size(agent: Agent) -> int:
    try:
        value = int(getattr(agent, "launcher_size", None) or 160)
    except (TypeError, ValueError):
        value = 160
    return max(80, min(value, 320))


def _panel_width(agent: Agent) -> int:
    try:
        value = int(getattr(agent, "panel_width", None) or 280)
    except (TypeError, ValueError):
        value = 280
    return max(220, min(value, 420))


def _show_transcription(agent: Agent) -> bool:
    return bool(getattr(agent, "show_transcription", False))


def _launcher_bootstrap(agent: Agent) -> WidgetBootstrapOut:
    mode = (getattr(agent, "launcher_mode", None) or "mic").strip().lower()
    if mode not in ("mic", "avatar", "floating"):
        mode = "mic"
    label = (getattr(agent, "launcher_label", None) or "Tap to talk with AI").strip()
    color = (getattr(agent, "launcher_color", None) or "#2563eb").strip()
    skin_id = getattr(agent, "launcher_skin", None) or ""
    skin = None
    if mode in ("avatar", "floating") and skin_id:
        payload = get_skin_payload(skin_id)
        if payload:
            skin = LauncherSkinPayload(
                id=payload["id"],
                avatar_url=payload["avatar_url"],
                idle_frames=payload.get("idle_frames") or [],
            )
        else:
            mode = "mic"
    elif mode in ("avatar", "floating"):
        mode = "mic"
    return WidgetBootstrapOut(
        launcher_mode=mode,
        launcher_label=label or "Tap to talk with AI",
        launcher_color=color or "#2563eb",
        launcher_size=_launcher_size(agent),
        panel_width=_panel_width(agent),
        show_transcription=_show_transcription(agent),
        skin=skin,
    )


@router.get("/bootstrap", response_model=WidgetBootstrapOut)
def widget_bootstrap(
    request: Request,
    public_key: str = Query(..., min_length=8),
    db: Session = Depends(get_db),
):
    widget_session_limiter.check(f"widget-bootstrap:{client_ip(request)}")
    agent = db.query(Agent).filter(Agent.public_key == public_key).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Unknown agent key")

    origin_header = request.headers.get("origin")
    if origin_header:
        origin = resolve_request_origin(origin_header, None)
        if origin and not origin_allowed(agent.allowed_origins, origin):
            raise HTTPException(status_code=403, detail="Origin is not allowed for this agent")

    return _launcher_bootstrap(agent)


@router.post("/session", response_model=WidgetSessionOut)
async def create_session(
    body: WidgetSessionIn,
    request: Request,
    db: Session = Depends(get_db),
):
    widget_session_limiter.check(f"widget-session:{client_ip(request)}")

    agent = db.query(Agent).filter(Agent.public_key == body.public_key).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Unknown agent key")

    # Prefer browser Origin header; reject mismatched body.origin (tamper signal).
    origin = resolve_request_origin(request.headers.get("origin"), body.origin)
    if not origin:
        raise HTTPException(status_code=403, detail="Origin is required and must be valid")
    if not origin_allowed(agent.allowed_origins, origin):
        raise HTTPException(status_code=403, detail="Origin is not allowed for this agent")

    owner = db.get(User, agent.user_id)
    call_limit = _max_call_minutes(agent)
    if owner and not owner.is_admin and not bool(getattr(owner, "is_approved", False)):
        return WidgetSessionOut(
            livekit_url="",
            token="",
            room_name="",
            agent_name=settings.agent_name,
            voice_enabled=False,
            message="This agent is unavailable until the account is approved.",
            character=_character_for_agent(agent),
            character_size=_character_size(agent),
            panel_width=_panel_width(agent),
            show_transcription=_show_transcription(agent),
            max_call_minutes=call_limit,
        )
    if owner and plan_exhausted(db, owner):
        return WidgetSessionOut(
            livekit_url="",
            token="",
            room_name="",
            agent_name=settings.agent_name,
            voice_enabled=False,
            message="Monthly voice minute cap reached. Dashboard still works.",
            character=_character_for_agent(agent),
            character_size=_character_size(agent),
            panel_width=_panel_width(agent),
            show_transcription=_show_transcription(agent),
            max_call_minutes=call_limit,
        )

    if not livekit_configured():
        return WidgetSessionOut(
            livekit_url="",
            token="",
            room_name="",
            agent_name=settings.agent_name,
            voice_enabled=False,
            message="LiveKit is not configured. Dashboard and FAQ still work.",
            character=_character_for_agent(agent),
            character_size=_character_size(agent),
            panel_width=_panel_width(agent),
            show_transcription=_show_transcription(agent),
            max_call_minutes=call_limit,
        )

    room_name = f"agent-{agent.id}-{secrets.token_hex(6)}"
    identity = f"visitor-{secrets.token_hex(4)}"

    try:
        from livekit.api import AccessToken, VideoGrants
        from livekit.api import LiveKitAPI, CreateRoomRequest
    except ImportError as exc:
        raise HTTPException(status_code=500, detail=f"LiveKit SDK missing: {exc}") from exc

    metadata = json.dumps({"agent_id": agent.id, "public_key": agent.public_key})

    try:
        from livekit.api import RoomAgentDispatch

        lk = LiveKitAPI(settings.livekit_url, settings.livekit_api_key, settings.livekit_api_secret)
        await lk.room.create_room(
            CreateRoomRequest(
                name=room_name,
                metadata=metadata,
                agents=[RoomAgentDispatch(agent_name=settings.agent_name)],
            )
        )
        await lk.aclose()
    except Exception:
        # Room may still be auto-created on first join; continue with token.
        pass

    token = (
        AccessToken(settings.livekit_api_key, settings.livekit_api_secret)
        .with_identity(identity)
        .with_name("Visitor")
        .with_metadata(metadata)
        .with_grants(
            VideoGrants(
                room_join=True,
                room=room_name,
                can_publish=True,
                can_subscribe=True,
            )
        )
    )
    if hasattr(token, "with_ttl"):
        # Match configured call limit (+1 min buffer for connect/goodbye)
        token = token.with_ttl(timedelta(minutes=call_limit + 1))
    token = token.to_jwt()

    return WidgetSessionOut(
        livekit_url=settings.livekit_url,
        token=token,
        room_name=room_name,
        agent_name=settings.agent_name,
        voice_enabled=True,
        message=None,
        character=_character_for_agent(agent),
        character_size=_character_size(agent),
        panel_width=_panel_width(agent),
        show_transcription=_show_transcription(agent),
        max_call_minutes=call_limit,
    )
