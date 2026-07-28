import logging
from abc import ABC, abstractmethod

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class BaseLLM(ABC):
    @abstractmethod
    async def generate(
        self,
        system_prompt: str,
        conversation_history: list[dict],
        response_format: str = "text",
    ) -> str:
        raise NotImplementedError


class OpenRouterLLM(BaseLLM):
    async def generate(
        self,
        system_prompt: str,
        conversation_history: list[dict],
        response_format: str = "text",
    ) -> str:
        if not settings.llm_api_key:
            raise RuntimeError("LLM_API_KEY is not configured")

        payload: dict = {
            "model": settings.llm_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                *conversation_history,
            ],
        }
        if response_format == "json":
            payload["response_format"] = {"type": "json_object"}

        headers = {
            "Authorization": f"Bearer {settings.llm_api_key}",
            "Content-Type": "application/json",
        }
        url = f"{settings.llm_base_url.rstrip('/')}/chat/completions"

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()

        return response.json()["choices"][0]["message"]["content"]


class GroqLLM(BaseLLM):
    API_URL = "https://api.groq.com/openai/v1/chat/completions"

    async def generate(
        self,
        system_prompt: str,
        conversation_history: list[dict],
        response_format: str = "text",
    ) -> str:
        if not settings.fallback_api_key:
            raise RuntimeError("FALLBACK_API_KEY is not configured")

        payload: dict = {
            "model": settings.fallback_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                *conversation_history,
            ],
        }
        if response_format == "json":
            payload["response_format"] = {"type": "json_object"}

        headers = {
            "Authorization": f"Bearer {settings.fallback_api_key}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                self.API_URL,
                headers=headers,
                json=payload,
            )
            response.raise_for_status()

        return response.json()["choices"][0]["message"]["content"]


class GeminiLLM(BaseLLM):
    API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

    async def generate(
        self,
        system_prompt: str,
        conversation_history: list[dict],
        response_format: str = "text",
    ) -> str:
        if not settings.fallback_api_key:
            raise RuntimeError("FALLBACK_API_KEY is not configured")

        contents = [
            {
                "role": "model" if turn["role"] == "assistant" else "user",
                "parts": [{"text": turn["content"]}],
            }
            for turn in conversation_history
        ]
        payload: dict = {
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "contents": contents,
        }
        if response_format == "json":
            payload["generationConfig"] = {
                "response_mime_type": "application/json",
            }

        url = f"{self.API_BASE_URL}/{settings.fallback_model}:generateContent"
        params = {"key": settings.fallback_api_key}

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url, params=params, json=payload)
            response.raise_for_status()

        return response.json()["candidates"][0]["content"]["parts"][0]["text"]


class FallbackLLM(BaseLLM):
    def __init__(self, primary: BaseLLM, fallback: BaseLLM) -> None:
        self.primary = primary
        self.fallback = fallback

    async def generate(
        self,
        system_prompt: str,
        conversation_history: list[dict],
        response_format: str = "text",
    ) -> str:
        try:
            return await self.primary.generate(
                system_prompt,
                conversation_history,
                response_format,
            )
        except Exception:
            logger.warning(
                "Primary LLM failed; retrying with fallback provider",
                exc_info=True,
            )
            return await self.fallback.generate(
                system_prompt,
                conversation_history,
                response_format,
            )


def get_llm() -> BaseLLM:
    primary = OpenRouterLLM()
    fallback: BaseLLM
    if settings.llm_fallback_provider.lower() == "gemini":
        fallback = GeminiLLM()
    else:
        fallback = GroqLLM()
    return FallbackLLM(primary, fallback)
