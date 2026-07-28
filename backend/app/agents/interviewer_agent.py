import json
import logging

from app.agents.llm import BaseLLM
from app.agents.prompts.judge_prompt import JUDGE_SYSTEM_PROMPT

logger = logging.getLogger(__name__)


class InterviewerAgent:
    def __init__(self, llm: BaseLLM) -> None:
        self.llm = llm

    async def next_action(
        self,
        current_question: str,
        candidate_answer: str,
        conversation_history: list[dict],
        follow_up_count: int,
    ) -> dict:
        history = [
            *conversation_history,
            {"role": "assistant", "content": current_question},
            {"role": "user", "content": candidate_answer},
        ]

        raw_response = await self.llm.generate(
            system_prompt=JUDGE_SYSTEM_PROMPT,
            conversation_history=history,
            response_format="json",
        )

        try:
            result = json.loads(raw_response)
            if not isinstance(result, dict):
                raise TypeError("Model response is not a JSON object")
            required_keys = {"assessment", "action", "next_utterance"}
            if not required_keys.issubset(result):
                raise KeyError("Model response is missing required keys")
        except (json.JSONDecodeError, KeyError, TypeError):
            logger.warning("Could not parse LLM judge response: %r", raw_response)
            result = {
                "assessment": "could not parse model response",
                "action": "next_question",
                "next_utterance": "",
            }

        if follow_up_count >= 2:
            result["action"] = "next_question"

        return result
