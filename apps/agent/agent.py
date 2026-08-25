"""LiveKit voice worker — Q&A plus booking, orders, and support tools."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")

log = logging.getLogger("voice-agent")
logging.basicConfig(level=logging.INFO)

API_BASE = os.getenv("API_BASE_URL", "http://localhost:8000").rstrip("/")
INTERNAL_SECRET = os.getenv("INTERNAL_AGENT_SECRET", "")
AGENT_NAME = os.getenv("AGENT_NAME", "voice-qa")
OPENAI_REALTIME_MODEL = os.getenv("OPENAI_REALTIME_MODEL", "gpt-4o-realtime-preview")
transcripts: dict[str, list[dict]] = {}


def keys_ready() -> bool:
    return bool(os.getenv("LIVEKIT_API_KEY") and os.getenv("LIVEKIT_API_SECRET") and os.getenv("OPENAI_API_KEY"))


# Import on module load so the OpenAI plugin registers on the process main thread
# (required by livekit-agents; importing inside entrypoint fails in job workers).
from livekit.plugins import openai  # noqa: E402


def parse_agent_id(ctx) -> int | None:
    raw = ""
    room = getattr(ctx, "room", None)
    if room is not None:
        raw = getattr(room, "metadata", "") or ""
    job = getattr(ctx, "job", None)
    if not raw and job is not None:
        room_info = getattr(job, "room", None)
        raw = getattr(room_info, "metadata", "") or ""
    try:
        meta = json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        meta = {}
    agent_id = meta.get("agent_id")
    return int(agent_id) if agent_id is not None else None


async def api_call(method: str, path: str, json_body=None):
    async with httpx.AsyncClient(timeout=20) as client:
        res = await client.request(
            method,
            f"{API_BASE}{path}",
            headers={"X-Agent-Secret": INTERNAL_SECRET, "Content-Type": "application/json"},
            json=json_body,
        )
        try:
            data = res.json()
        except Exception:
            data = {"detail": res.text}
        if res.status_code >= 400:
            return {"ok": False, "status": res.status_code, "error": data}
        return {"ok": True, "data": data}


async def fetch_context(agent_id: int) -> dict:
    result = await api_call("GET", f"/v1/internal/agents/{agent_id}/context")
    if not result["ok"]:
        raise RuntimeError(result)
    return result["data"]


async def save_transcript(agent_id: int, room_name: str, messages: list[dict], minutes: float = 0) -> None:
    if not messages and minutes <= 0:
        return
    result = await api_call(
        "POST",
        f"/v1/internal/agents/{agent_id}/conversations",
        {
            "room_name": room_name,
            "visitor_identity": "visitor",
            "messages": messages,
            "minutes": minutes,
        },
    )
    if not result.get("ok"):
        log.error("save_transcript failed: %s", result)


async def save_ai_usage(
    agent_id: int,
    room_name: str,
    minutes: float,
    metrics: dict,
    model: str,
) -> None:
    result = await api_call(
        "POST",
        f"/v1/internal/agents/{agent_id}/ai-usage",
        {
            "room_name": room_name,
            "model": model,
            "input_tokens": int(metrics.get("input_tokens") or 0),
            "output_tokens": int(metrics.get("output_tokens") or 0),
            "audio_input_tokens": int(metrics.get("audio_input_tokens") or 0),
            "audio_output_tokens": int(metrics.get("audio_output_tokens") or 0),
            "minutes": minutes,
        },
    )
    if not result.get("ok"):
        log.error("save_ai_usage failed: %s", result)


def _accumulate_metrics(bucket: dict, ev) -> None:
    """Best-effort parse of LiveKit / OpenAI realtime metric events."""
    metric = getattr(ev, "metrics", ev)
    candidates = [metric, getattr(ev, "usage", None), ev]
    for obj in candidates:
        if obj is None:
            continue
        for src_key, dst_key in (
            ("input_tokens", "input_tokens"),
            ("output_tokens", "output_tokens"),
            ("prompt_tokens", "input_tokens"),
            ("completion_tokens", "output_tokens"),
            ("input_token_count", "input_tokens"),
            ("output_token_count", "output_tokens"),
            ("audio_input_tokens", "audio_input_tokens"),
            ("audio_output_tokens", "audio_output_tokens"),
            ("input_audio_tokens", "audio_input_tokens"),
            ("output_audio_tokens", "audio_output_tokens"),
        ):
            val = getattr(obj, src_key, None)
            if val is None and isinstance(obj, dict):
                val = obj.get(src_key)
            if val is not None:
                try:
                    bucket[dst_key] = int(bucket.get(dst_key) or 0) + int(val)
                except (TypeError, ValueError):
                    pass


def build_instructions(ctx_data: dict) -> str:
    from datetime import date

    prompt = ctx_data.get("system_prompt") or "You are a helpful voice assistant."
    knowledge = ctx_data.get("knowledge") or "No knowledge documents yet."
    language = ctx_data.get("language") or "en"
    name = ctx_data.get("name") or "Assistant"
    modules = ctx_data.get("modules") or {}
    site_pages = ctx_data.get("site_pages") or []
    today = date.today().isoformat()
    duties = []
    if modules.get("qa", True):
        duties.append("answer questions using the knowledge base only")
    if modules.get("booking"):
        duties.append(
            "book meetings: call list_available_slots with YYYY-MM-DD then create_booking once. "
            "Only offer dates returned by the tool (usually within about two weeks). "
            "Never invent slots. Collect the visitor's name before booking. "
            "After create_booking succeeds, clearly confirm the date and time once — do not call create_booking again"
        )
    if modules.get("orders"):
        duties.append(
            "take orders: call list_products first when helpful, collect name, phone, address, and items, "
            "prefer catalog names and prices, allow items not on the list, repeat them back, then create_order"
        )
    if modules.get("support"):
        duties.append(
            "file support tickets with create_support_ticket, then say a person will follow up. "
            "Do not claim a human is on this call"
        )
    if site_pages:
        page_list = ", ".join(
            f"{p.get('key')} ({p.get('label')})" for p in site_pages if p.get("key")
        )
        duties.append(
            "open website pages when asked: call navigate_to_page with the exact page key from "
            f"[{page_list}]. Say one short sentence confirming, then the browser redirects. "
            "Only use listed keys — never invent URLs"
        )
    duty_text = "; ".join(duties) or "help the visitor briefly"
    return (
        f"{prompt}\n\n"
        f"Your name is {name}. Speak in language code '{language}'. "
        f"Today's date is {today}. "
        f"Keep spoken answers short and continuous — avoid long pauses mid-sentence. "
        f"You may {duty_text}.\n"
        "When the visitor says goodbye, thanks and is done, or asks to hang up / end the call, "
        "call the end_call tool (say a brief goodbye; the tool disconnects the call).\n"
        "If a tool returns an error that a module is off, apologize and offer something else.\n"
        "If a tool returns ok=false, explain the error briefly and try another slot or date — "
        "do not claim success.\n"
        "If a tool returns ok=true for a booking, tell the visitor it is confirmed.\n"
        "If a tool returns ok=true for navigate_to_page, confirm you are opening that page.\n\n"
        f"KNOWLEDGE BASE:\n{knowledge}"
    )


def greeting_line(modules: dict, site_pages: list | None = None) -> str:
    offers = []
    if modules.get("qa", True):
        offers.append("answer questions")
    if modules.get("booking"):
        offers.append("book a meeting")
    if modules.get("orders"):
        offers.append("take an order")
    if modules.get("support"):
        offers.append("open a support ticket")
    if site_pages:
        offers.append("open pages on this site")
    if not offers:
        return "Greet the visitor briefly."
    return "Greet the visitor briefly and offer to " + ", ".join(offers) + "."


def _tool_result(result: dict) -> str:
    """Normalize API results so the realtime model can tell success from failure."""
    if not result.get("ok"):
        err = result.get("error") or {}
        detail = err.get("detail") if isinstance(err, dict) else err
        return json.dumps(
            {"ok": False, "error": detail or result.get("status") or "request failed"},
            default=str,
        )
    data = result.get("data")
    if isinstance(data, dict):
        return json.dumps({"ok": True, **data}, default=str)
    return json.dumps({"ok": True, "data": data}, default=str)


async def _publish_navigate(page_key: str, path: str) -> bool:
    """Send navigate command to the visitor widget via LiveKit data channel."""
    payload = json.dumps({"type": "navigate", "key": page_key, "path": path}).encode("utf-8")
    try:
        from livekit.agents import get_job_context

        job = get_job_context()
        room = job.room
        lp = room.local_participant
        try:
            await lp.publish_data(payload, reliable=True)
            return True
        except TypeError:
            await lp.publish_data(payload)
            return True
    except Exception:
        log.exception("publish_data navigate failed")
        return False


async def _hangup_call(delay_s: float = 2.5) -> None:
    """Wait briefly for goodbye speech, then delete the LiveKit room."""
    try:
        await asyncio.sleep(delay_s)
    except Exception:
        pass
    try:
        from livekit.agents import get_job_context

        job = get_job_context()
        fut = job.delete_room()
        if fut is not None:
            await fut
        job.shutdown("end_call")
    except Exception:
        log.exception("delete_room / shutdown failed")


def make_voice_agent(instructions: str, agent_id: int, site_pages: list | None = None):
    from livekit.agents import Agent

    try:
        from livekit.agents import function_tool
    except ImportError:
        from livekit.agents.llm import function_tool

    pages = list(site_pages or [])
    pages_by_key = {
        str(p.get("key") or "").strip().lower(): p
        for p in pages
        if p.get("key") and p.get("path")
    }

    class VoiceAgent(Agent):
        def __init__(self):
            super().__init__(instructions=instructions)
            self._agent_id = agent_id
            self._site_pages = pages_by_key

        @function_tool()
        async def list_products(self) -> str:
            """List active catalog products (name, sku, price) when taking an order."""
            result = await api_call("GET", f"/v1/internal/agents/{self._agent_id}/products")
            return _tool_result(result)

        @function_tool()
        async def list_available_slots(self, date: str) -> str:
            """List open meeting slots. date must be YYYY-MM-DD near today (within max_days_ahead)."""
            result = await api_call(
                "GET", f"/v1/internal/agents/{self._agent_id}/booking/slots?date={date}"
            )
            return _tool_result(result)

        @function_tool()
        async def create_booking(
            self,
            guest_name: str,
            starts_at: str,
            guest_phone: str = "",
            guest_email: str = "",
            notes: str = "",
        ) -> str:
            """Create a meeting once. starts_at is ISO local time like 2026-08-20T15:00. Confirm details with the visitor first. Do not call again after ok=true."""
            result = await api_call(
                "POST",
                f"/v1/internal/agents/{self._agent_id}/booking",
                {
                    "guest_name": guest_name,
                    "guest_phone": guest_phone,
                    "guest_email": guest_email,
                    "notes": notes,
                    "starts_at": starts_at,
                },
            )
            return _tool_result(result)

        @function_tool()
        async def create_order(
            self,
            customer_name: str,
            items: str,
            phone: str = "",
            address: str = "",
            notes: str = "",
        ) -> str:
            """Save an order after repeating name, phone, address, and items back to the visitor."""
            result = await api_call(
                "POST",
                f"/v1/internal/agents/{self._agent_id}/orders",
                {
                    "customer_name": customer_name,
                    "phone": phone,
                    "address": address,
                    "items": items,
                    "notes": notes,
                },
            )
            return _tool_result(result)

        @function_tool()
        async def create_support_ticket(
            self,
            subject: str,
            body: str,
            visitor_name: str = "",
            phone: str = "",
            email: str = "",
        ) -> str:
            """File a support ticket for a human to follow up later."""
            result = await api_call(
                "POST",
                f"/v1/internal/agents/{self._agent_id}/tickets",
                {
                    "visitor_name": visitor_name,
                    "phone": phone,
                    "email": email,
                    "subject": subject,
                    "body": body,
                },
            )
            return _tool_result(result)

        @function_tool()
        async def navigate_to_page(self, page_key: str) -> str:
            """Send the visitor to a configured site page (login, register, contact, menu, ...). Use the exact page key from instructions."""
            key = (page_key or "").strip().lower()
            page = self._site_pages.get(key)
            if not page:
                known = ", ".join(sorted(self._site_pages.keys())) or "none"
                return json.dumps(
                    {
                        "ok": False,
                        "error": f"Unknown page key '{page_key}'. Known keys: {known}",
                    }
                )
            path = str(page.get("path") or "").strip()
            sent = await _publish_navigate(key, path)
            if not sent:
                return json.dumps({"ok": False, "error": "Could not send navigation to the browser"})
            label = page.get("label") or key
            return json.dumps(
                {
                    "ok": True,
                    "key": key,
                    "label": label,
                    "path": path,
                    "message": (
                        f"Say one short sentence that you are opening {label} now. "
                        "The visitor's browser will navigate shortly."
                    ),
                }
            )

        @function_tool()
        async def end_call(self) -> str:
            """End the voice call after the visitor says goodbye, thanks and is finished, or asks to hang up / end the call."""
            asyncio.create_task(_hangup_call())
            return (
                "Say a brief warm goodbye in one short sentence now. "
                "Do not ask more questions. The call will disconnect after you finish speaking."
            )

    return VoiceAgent()


async def entrypoint(ctx):
    from livekit.agents import AgentSession, RoomOutputOptions
    from openai.types.realtime import realtime_audio_input_turn_detection

    agent_id = parse_agent_id(ctx)
    if not agent_id:
        log.warning("No agent_id in room metadata")
        await ctx.connect()
        return

    ctx_data = await fetch_context(agent_id)
    site_pages = ctx_data.get("site_pages") or []
    instructions = build_instructions(ctx_data)
    voice = ctx_data.get("voice") or "alloy"
    realtime_model = ctx_data.get("realtime_model") or OPENAI_REALTIME_MODEL
    room_name = getattr(ctx.room, "name", None) or f"agent-{agent_id}"
    key = room_name
    transcripts[key] = []
    metrics_bucket: dict = {}
    started = time.time()

    await ctx.connect()

    # Soft barge-in (avoids choppy interrupts). medium eagerness was too aggressive.
    # sync_transcription=False avoids TranscriptSynchronizer chopping audio playout.
    turn_detection = realtime_audio_input_turn_detection.SemanticVad(
        type="semantic_vad",
        create_response=True,
        eagerness="low",
        interrupt_response=True,
    )

    try:
        realtime_llm = openai.realtime.RealtimeModel(
            model=realtime_model,
            voice=voice,
            input_audio_noise_reduction="near_field",
            turn_detection=turn_detection,
        )
    except TypeError:
        try:
            realtime_llm = openai.realtime.RealtimeModel(
                voice=voice,
                input_audio_noise_reduction="near_field",
                turn_detection=turn_detection,
            )
        except TypeError:
            realtime_llm = openai.realtime.RealtimeModel(voice=voice)

    try:
        session = AgentSession(
            llm=realtime_llm,
            min_interruption_duration=0.9,
            min_endpointing_delay=0.5,
            false_interruption_timeout=1.5,
            resume_false_interruption=True,
        )
    except TypeError:
        session = AgentSession(llm=realtime_llm)

    def on_user(ev):
        text = getattr(ev, "transcript", None) or getattr(ev, "text", None) or str(ev)
        if text:
            transcripts[key].append({"role": "user", "content": str(text)})

    def on_metrics(ev):
        try:
            _accumulate_metrics(metrics_bucket, ev)
        except Exception:
            pass

    try:
        session.on("user_input_transcribed", on_user)
    except Exception:
        pass
    try:
        session.on("conversation_item_added", lambda ev: _capture_item(key, ev))
    except Exception:
        pass
    for evt in ("metrics_collected", "metrics_updated", "usage_updated"):
        try:
            session.on(evt, on_metrics)
        except Exception:
            pass

    start_kwargs = {
        "room": ctx.room,
        "agent": make_voice_agent(instructions, agent_id, site_pages),
    }
    try:
        start_kwargs["room_output_options"] = RoomOutputOptions(sync_transcription=False)
    except TypeError:
        pass

    await session.start(**start_kwargs)
    try:
        await session.generate_reply(
            instructions=greeting_line(ctx_data.get("modules") or {}, site_pages)
        )
    except Exception:
        log.exception("generate_reply failed")

    async def on_shutdown():
        minutes = max(0.1, (time.time() - started) / 60.0)
        await save_transcript(agent_id, room_name, transcripts.get(key, []), minutes)
        try:
            await save_ai_usage(agent_id, room_name, minutes, metrics_bucket, realtime_model)
        except Exception:
            log.exception("save_ai_usage failed")
        transcripts.pop(key, None)

    try:
        ctx.add_shutdown_callback(on_shutdown)
    except Exception:
        asyncio.create_task(_watch_disconnect(ctx, on_shutdown))


def _capture_item(key: str, ev) -> None:
    item = getattr(ev, "item", ev)
    role = getattr(item, "role", None) or getattr(ev, "role", None)
    content = getattr(item, "text_content", None) or getattr(item, "content", None) or getattr(ev, "text", None)
    if isinstance(content, list):
        parts = []
        for part in content:
            parts.append(getattr(part, "text", None) or str(part))
        content = " ".join(parts)
    if role and content:
        transcripts.setdefault(key, []).append({"role": str(role), "content": str(content)})


async def _watch_disconnect(ctx, on_shutdown):
    room = ctx.room
    try:
        while True:
            await asyncio.sleep(2)
            if getattr(room, "connection_state", "") in ("disconnected", "DISCONNECTED"):
                await on_shutdown()
                return
    except Exception:
        await on_shutdown()


def idle_loop() -> None:
    log.warning(
        "LIVEKIT_API_KEY / LIVEKIT_API_SECRET / OPENAI_API_KEY missing. "
        "Agent idle — API and dashboard can still run."
    )
    while True:
        time.sleep(60)


if __name__ == "__main__":
    if not keys_ready():
        idle_loop()
    from livekit.agents import WorkerOptions, cli

    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, agent_name=AGENT_NAME))
