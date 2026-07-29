import secrets
from datetime import datetime, timedelta, timezone

import httpx

from app.config import settings

DAILY_API_BASE_URL = "https://api.daily.co/v1"


def _auth_headers() -> dict[str, str]:
    if not settings.daily_api_key:
        raise RuntimeError("DAILY_API_KEY is not configured")
    return {"Authorization": f"Bearer {settings.daily_api_key}"}


async def create_daily_room(session_id: int) -> dict:
    expires_at = int(
        (datetime.now(timezone.utc) + timedelta(hours=2)).timestamp()
    )
    payload = {
        "name": f"interview-{session_id}-{secrets.token_urlsafe(6)}",
        "properties": {
            "enable_chat": False,
            "start_video_off": False,
            "start_audio_off": False,
            "exp": expires_at,
        },
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{DAILY_API_BASE_URL}/rooms",
            headers=_auth_headers(),
            json=payload,
        )
        response.raise_for_status()

    return response.json()["url"]


async def create_daily_token(room_name: str, is_owner: bool = False) -> str:
    payload = {
        "properties": {
            "room_name": room_name,
            "is_owner": is_owner,
        },
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{DAILY_API_BASE_URL}/meeting-tokens",
            headers=_auth_headers(),
            json=payload,
        )
        response.raise_for_status()

    return response.json()["token"]
