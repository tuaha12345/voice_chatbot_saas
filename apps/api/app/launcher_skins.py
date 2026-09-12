"""Scan static/launchers skins for idle widget (avatar / floating).

Layout:
  apps/api/static/launchers/<skin_id>/idle/*.png
  optional: apps/api/static/launchers/<skin_id>/avatar.png
"""

from __future__ import annotations

import re
from pathlib import Path

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
LAUNCHERS_DIR = STATIC_DIR / "launchers"

_FRAME_RE = re.compile(r"(\d+)")
_MAX_IDLE_FRAMES = 70


def _natural_sort_key(name: str) -> tuple:
    parts = _FRAME_RE.split(name)
    key: list = []
    for part in parts:
        if part.isdigit():
            key.append(int(part))
        else:
            key.append(part.lower())
    return tuple(key)


def _idle_dir(skin_id: str) -> Path:
    return LAUNCHERS_DIR / skin_id / "idle"


def _list_idle_names(skin_id: str) -> list[str]:
    idle = _idle_dir(skin_id)
    if not idle.is_dir():
        return []
    return sorted(
        (p.name for p in idle.iterdir() if p.suffix.lower() == ".png"),
        key=_natural_sort_key,
    )


def _subsample(frames: list[str]) -> list[str]:
    """Cap idle frames so embed pages do not download/process hundreds of PNGs."""
    if len(frames) <= _MAX_IDLE_FRAMES:
        return frames
    step = max(1, int(round(len(frames) / float(_MAX_IDLE_FRAMES))))
    sampled = frames[::step]
    if sampled[-1] != frames[-1]:
        sampled.append(frames[-1])
    return sampled[:_MAX_IDLE_FRAMES]


def list_skins() -> list[str]:
    if not LAUNCHERS_DIR.is_dir():
        return []
    skins: list[str] = []
    for entry in sorted(LAUNCHERS_DIR.iterdir()):
        if not entry.is_dir():
            continue
        if _list_idle_names(entry.name) or (entry / "avatar.png").is_file():
            skins.append(entry.name)
    return skins


def get_skin_payload(skin_id: str) -> dict | None:
    if not skin_id or "/" in skin_id or "\\" in skin_id or ".." in skin_id:
        return None
    skin_dir = LAUNCHERS_DIR / skin_id
    if not skin_dir.is_dir():
        return None

    idle_names = _list_idle_names(skin_id)
    avatar_file = skin_dir / "avatar.png"
    if avatar_file.is_file():
        avatar_url = f"/static/launchers/{skin_id}/avatar.png"
    elif idle_names:
        mid = idle_names[len(idle_names) // 2]
        avatar_url = f"/static/launchers/{skin_id}/idle/{mid}"
    else:
        return None

    idle_frames = [
        f"/static/launchers/{skin_id}/idle/{name}" for name in _subsample(idle_names)
    ]
    return {
        "id": skin_id,
        "avatar_url": avatar_url,
        "idle_frames": idle_frames,
    }


def skin_preview_url(skin_id: str) -> str:
    payload = get_skin_payload(skin_id)
    return payload["avatar_url"] if payload else ""


def skin_label(skin_id: str) -> str:
    return skin_id.replace("_", " ").title()
