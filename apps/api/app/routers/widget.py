from __future__ import annotations

import json
import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.character_packs import build_character_payload
from app.models import Agent, User
from app.schemas import CharacterOut, CharacterStatesOut, WidgetSessionIn, WidgetSessionOut
from app.usage import plan_exhausted

router = APIRouter(prefix="/v1/widget", tags=["widget"])


def origin_allowed(allowed: str, origin: str | None) -> bool:
    if not allowed or allowed.strip() == "*":
        return True
    if not origin:
        return False
    origin = origin.rstrip("/")
    parts = [p.strip().rstrip("/") for p in allowed.split(",") if p.strip()]
    if origin in parts:
        return True
    if origin.startswith("http://localhost") or origin.startswith("http://127.0.0.1"):
        return True
    return False


def livekit_configured() -> bool:
    return bool(settings.livekit_url and settings.livekit_api_key and settings.livekit_api_secret)


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


@router.post("/session", response_model=WidgetSessionOut)
async def create_session(
    body: WidgetSessionIn,
    request: Request,
    db: Session = Depends(get_db),
):
    agent = db.query(Agent).filter(Agent.public_key == body.public_key).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Unknown agent key")

    origin = body.origin or request.headers.get("origin")
    if not origin_allowed(agent.allowed_origins, origin):
        raise HTTPException(status_code=403, detail="Origin is not allowed for this agent")

    owner = db.get(User, agent.user_id)
    if owner and plan_exhausted(db, owner):
        return WidgetSessionOut(
            livekit_url="",
            token="",
            room_name="",
            agent_name=settings.agent_name,
            voice_enabled=False,
            message="Monthly voice minute cap reached. Dashboard still works.",
            character=_character_for_agent(agent),
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
        token = token.with_ttl(timedelta(hours=2))
    token = token.to_jwt()

    return WidgetSessionOut(
        livekit_url=settings.livekit_url,
        token=token,
        room_name=room_name,
        agent_name=settings.agent_name,
        voice_enabled=True,
        message=None,
        character=_character_for_agent(agent),
    )
