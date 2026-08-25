"""Scan static character animation packs and expose frame URL lists."""

from __future__ import annotations

import re
from pathlib import Path

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

# Folder on disk -> API state key
_STATE_ALIASES: dict[str, str] = {
    "listning": "listening",
    "listening": "listening",
    "welcome": "welcome",
    "speaking": "speaking",
    "bye": "bye",
}

_FRAME_RE = re.compile(r"(\d+)")

_cache: dict[str, dict[str, list[str]]] = {}


def clear_pack_cache() -> None:
    _cache.clear()


def _natural_sort_key(name: str) -> tuple:
    parts = _FRAME_RE.split(name)
    key: list = []
    for part in parts:
        if part.isdigit():
            key.append(int(part))
        else:
            key.append(part.lower())
    return tuple(key)


def _scan_pack(pack: str) -> dict[str, list[str]]:
    pack_dir = STATIC_DIR / pack
    if not pack_dir.is_dir():
        return {}

    states: dict[str, list[str]] = {}
    for folder in sorted(pack_dir.iterdir()):
        if not folder.is_dir():
            continue
        state_key = _STATE_ALIASES.get(folder.name.lower())
        if not state_key:
            continue
        frames = sorted(
            (p.name for p in folder.iterdir() if p.suffix.lower() == ".png"),
            key=_natural_sort_key,
        )
        if frames:
            # Speaking pack is huge (~75MB / 187 frames) — light subsample (keep motion smoother).
            if state_key == "speaking" and len(frames) > 64:
                frames = frames[::2]
            base = f"/static/{pack}/{folder.name}"
            states[state_key] = [f"{base}/{name}" for name in frames]
    return states


def list_packs() -> list[str]:
    if not STATIC_DIR.is_dir():
        return []
    packs: list[str] = []
    for entry in sorted(STATIC_DIR.iterdir()):
        if not entry.is_dir():
            continue
        states = _scan_pack(entry.name)
        if states:
            packs.append(entry.name)
    return packs


def get_pack_frames(pack: str) -> dict[str, list[str]] | None:
    if pack in _cache:
        return _cache[pack]
    states = _scan_pack(pack)
    if not states:
        return None
    _cache[pack] = states
    return states


def build_character_payload(pack: str, enabled: bool) -> dict | None:
    if not enabled:
        return None
    states = get_pack_frames(pack)
    if not states:
        return None
    return {
        "enabled": True,
        "pack": pack,
        "base_url": f"/static/{pack}",
        "states": states,
    }
