import asyncio

from app.agents.interviewer_agent import InterviewerAgent
from app.agents.llm import get_llm


async def main() -> None:
    llm = get_llm()

    plain_reply = await llm.generate(
        system_prompt="Reply helpfully and concisely.",
        conversation_history=[
            {"role": "user", "content": "Say hello in one short sentence."},
        ],
    )
    print("Plain-text LLM reply:")
    print(plain_reply)

    agent = InterviewerAgent(get_llm())
    current_question = "Tell me about a difficult production issue you resolved."
    vague_answer = "There was a problem once, and I worked with the team to fix it."

    decision = await agent.next_action(
        current_question=current_question,
        candidate_answer=vague_answer,
        conversation_history=[],
        follow_up_count=0,
    )
    print("\nDecision for vague answer:")
    print(decision)

    guarded_decision = await agent.next_action(
        current_question=current_question,
        candidate_answer=vague_answer,
        conversation_history=[],
        follow_up_count=2,
    )
    print("\nDecision with follow_up_count=2:")
    print(guarded_decision)
    assert guarded_decision["action"] == "next_question"
    print("Guardrail confirmed: action was forced to 'next_question'.")


if __name__ == "__main__":
    asyncio.run(main())
