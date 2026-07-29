import logging
from abc import ABC, abstractmethod

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class BaseSTT(ABC):
    @abstractmethod
    async def transcribe(self, audio_bytes: bytes) -> str:
        raise NotImplementedError


class GroqSTT(BaseSTT):
    API_URL = "https://api.groq.com/openai/v1/audio/transcriptions"

    async def transcribe(self, audio_bytes: bytes) -> str:
        headers = {"Authorization": f"Bearer {settings.groq_api_key}"}
        files = {
            "file": ("audio.wav", audio_bytes, "application/octet-stream"),
        }
        data = {"model": "whisper-large-v3-turbo"}

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                self.API_URL,
                headers=headers,
                files=files,
                data=data,
            )
            response.raise_for_status()

        return response.json()["text"]


class StubSTT(BaseSTT):
    async def transcribe(self, audio_bytes: bytes) -> str:
        return "This is a stub transcription."


class WhisperSTT(BaseSTT):
    async def transcribe(self, audio_bytes: bytes) -> str:
        files = {
            "file": ("audio.wav", audio_bytes, "application/octet-stream"),
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{settings.whisper_endpoint}/transcribe",
                    files=files,
                )
                response.raise_for_status()
        except httpx.ConnectError as exc:
            raise RuntimeError(
                "Could not connect to the local Whisper STT server; "
                "make sure it is running"
            ) from exc

        return response.json()["text"]


class SeamlessSTT(BaseSTT):
    async def transcribe(self, audio_bytes: bytes) -> str:
        files = {
            "file": ("audio.wav", audio_bytes, "application/octet-stream"),
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{settings.seamless_endpoint}/transcribe",
                    files=files,
                )
                response.raise_for_status()
        except httpx.ConnectError as exc:
            raise RuntimeError(
                "Could not connect to the local Seamless STT server; "
                "make sure it is running"
            ) from exc

        return response.json()["text"]


class FallbackSTT(BaseSTT):
    def __init__(self, primary: BaseSTT, fallback: BaseSTT) -> None:
        self.primary = primary
        self.fallback = fallback

    async def transcribe(self, audio_bytes: bytes) -> str:
        try:
            return await self.primary.transcribe(audio_bytes)
        except Exception:
            logger.warning(
                "Primary STT failed; retrying with fallback provider",
                exc_info=True,
            )
            return await self.fallback.transcribe(audio_bytes)


def get_stt(primary_provider: str) -> BaseSTT:
    if primary_provider == "whisper":
        primary: BaseSTT = WhisperSTT()
    elif primary_provider == "seamless":
        primary = SeamlessSTT()
    else:
        raise ValueError(f"Unsupported primary STT provider: {primary_provider}")

    return FallbackSTT(primary, GroqSTT())
