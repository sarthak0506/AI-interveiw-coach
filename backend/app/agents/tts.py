import base64
import logging
from abc import ABC, abstractmethod

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class BaseTTS(ABC):
    @abstractmethod
    async def synthesize(self, text: str) -> bytes:
        raise NotImplementedError


class SarvamTTS(BaseTTS):
    API_URL = "https://api.sarvam.ai/text-to-speech"

    async def synthesize(self, text: str) -> bytes:
        if not settings.sarvam_api_key:
            raise RuntimeError("SARVAM_API_KEY is not configured")

        headers = {
            # Double-check this header name against Sarvam's current docs
            # before relying on it, in case the API changes.
            "API-Subscription-Key": settings.sarvam_api_key,
            "Content-Type": "application/json",
        }
        payload = {
            "text": text,
            "target_language_code": settings.sarvam_target_language,
            "speaker": settings.sarvam_speaker,
            "model": settings.sarvam_model,
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                self.API_URL,
                headers=headers,
                json=payload,
            )
            response.raise_for_status()

        return base64.b64decode(response.json()["audios"][0])


class SupertonicTTS(BaseTTS):
    async def synthesize(self, text: str) -> bytes:
        url = f"{settings.supertonic_endpoint}/v1/tts"
        payload = {
            "text": text,
            "voice": settings.supertonic_voice,
            "lang": "en",
            "response_format": "wav",
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()

        return response.content


class ElevenLabsTTS(BaseTTS):
    API_BASE_URL = "https://api.elevenlabs.io/v1/text-to-speech"

    async def synthesize(self, text: str) -> bytes:
        if not settings.elevenlabs_api_key:
            raise RuntimeError("ELEVENLABS_API_KEY is not configured")
        if not settings.elevenlabs_voice_id:
            raise RuntimeError("ELEVENLABS_VOICE_ID is not configured")

        url = f"{self.API_BASE_URL}/{settings.elevenlabs_voice_id}"
        headers = {"xi-api-key": settings.elevenlabs_api_key}
        payload = {
            "text": text,
            "model_id": settings.elevenlabs_model,
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                url,
                headers=headers,
                json=payload,
            )
            response.raise_for_status()

        return response.content


class FallbackTTS(BaseTTS):
    def __init__(self, primary: BaseTTS, fallback: BaseTTS) -> None:
        self.primary = primary
        self.fallback = fallback

    async def synthesize(self, text: str) -> bytes:
        try:
            return await self.primary.synthesize(text)
        except Exception:
            logger.warning(
                "Primary TTS failed; retrying with fallback provider",
                exc_info=True,
            )
            return await self.fallback.synthesize(text)


def get_tts(primary_provider: str) -> BaseTTS:
    if primary_provider == "supertonic":
        primary: BaseTTS = SupertonicTTS()
    elif primary_provider == "sarvam":
        primary = SarvamTTS()
    else:
        raise ValueError(f"Unsupported primary TTS provider: {primary_provider}")

    return FallbackTTS(primary, ElevenLabsTTS())
