import json
import unittest

from app.agents.coach import InterviewCoach


class FakeLLM:
    def __init__(self, *responses: dict) -> None:
        self.responses = list(responses)
        self.prompts = []

    async def generate(self, system_prompt, conversation_history, response_format="text"):
        self.prompts.append(system_prompt)
        return json.dumps(self.responses.pop(0))


def rubric(relevance, evidence, structure, clarity):
    return {
        "relevance": {"score": relevance, "feedback": "The answer addresses the prompt."},
        "evidence": {"score": evidence, "feedback": "The answer gives a concrete example."},
        "structure": {"score": structure, "feedback": "The sequence is easy to follow."},
        "clarity": {"score": clarity, "feedback": "The main point is understandable."},
    }


class InterviewCoachRubricTests(unittest.IsolatedAsyncioTestCase):
    async def test_answer_score_is_derived_from_dimension_scores(self):
        llm = FakeLLM({
            "score": 100,
            "rubric": rubric(8, 6, 4, 10),
            "strengths": ["Clear project context"],
            "improvements": ["Add a measurable result"],
            "example_answer": "Describe your specific action and result.",
            "delivery_tip": "Pause before the result.",
        })

        result = await InterviewCoach(llm).evaluate_answer(
            "Python role", "Built Python services", "Describe a project", "I built a service."
        )

        self.assertEqual(result["score"], 70)
        self.assertEqual(result["rubric"]["evidence"]["score"], 6)
        self.assertIn("score anchors", llm.prompts[0])

    async def test_answer_requires_every_rubric_dimension(self):
        incomplete_rubric = rubric(8, 6, 4, 7)
        del incomplete_rubric["clarity"]
        llm = FakeLLM({"rubric": incomplete_rubric})
        with self.assertRaisesRegex(ValueError, "clarity"):
            await InterviewCoach(llm).evaluate_answer("role", "resume", "question", "answer")

    async def test_final_score_averages_dimension_scores_not_model_total(self):
        llm = FakeLLM({
            "score": 100,
            "summary": "You gave specific examples.",
            "strengths": ["Concrete actions"],
            "growth_areas": ["Explain outcomes"],
            "next_steps": ["Practice concise STAR examples"],
            "practice_prompt": "Add a measurable result next time.",
        })
        answers = [
            {"score": 70, "feedback": {"rubric": rubric(8, 6, 4, 10)}},
            {"score": 50, "feedback": {"rubric": rubric(2, 4, 8, 6)}},
        ]

        result = await InterviewCoach(llm).summarize_attempt("role", answers)

        self.assertEqual(result["score"], 60)
        self.assertEqual(result["rubric"]["relevance"]["score"], 5)
        self.assertEqual(result["rubric"]["clarity"]["score"], 8)


if __name__ == "__main__":
    unittest.main()
