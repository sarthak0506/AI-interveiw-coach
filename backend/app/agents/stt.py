from abc import ABC, abstractmethod

import httpx

from app.config import settings


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


def get_stt() -> BaseSTT:
    return GroqSTT()
