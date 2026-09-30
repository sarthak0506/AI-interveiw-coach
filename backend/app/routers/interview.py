import json
from datetime import datetime, timezone
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.agents.coach import InterviewCoach
from app.agents.llm import get_llm
from app.agents.room import create_daily_room, create_daily_token
from app.deps import get_db
from app.models import InterviewSession, PracticeAnswer, PracticeAttempt, Question
from app.schemas import InterviewSessionOut, PracticeAnswerCreate

router = APIRouter(prefix="/interview", tags=["interview"])


def _find_session(invite_token: str, db: Session) -> InterviewSession:
    session = (
        db.query(InterviewSession)
        .filter(InterviewSession.invite_token == invite_token)
        .first()
    )
    if session is None:
        raise HTTPException(status_code=404, detail="Invalid or expired invite link")
    return session


def _attempt_result(attempt: PracticeAttempt, questions: list[Question]) -> dict:
    current_question = None
    if attempt.status == "in_progress" and attempt.current_question_index < len(questions):
        question = questions[attempt.current_question_index]
        current_question = {"id": question.id, "text": question.text}
    return {
        "id": attempt.id,
        "attempt_number": attempt.attempt_number,
        "status": attempt.status,
        "current_question_index": attempt.current_question_index,
        "score": attempt.score,
        "report": json.loads(attempt.report_json) if attempt.report_json else None,
        "current_question": current_question,
        "answers": [
            {
                "question": answer.question_text,
                "answer": answer.answer_text,
                "score": answer.score,
                "feedback": json.loads(answer.feedback_json),
            }
            for answer in attempt.answers
        ],
    }


@router.get("/{invite_token}", response_model=InterviewSessionOut)
def get_interview_by_token(invite_token: str, db: Session = Depends(get_db)):
    """
    Public endpoint — no auth. The candidate app hits this with the token
    from their invite link to load the JD + question list.
    """
    return _find_session(invite_token, db)


@router.get("/{invite_token}/attempts")
def list_practice_attempts(invite_token: str, db: Session = Depends(get_db)):
    session = _find_session(invite_token, db)
    questions = list(session.questions)
    attempts = (
        db.query(PracticeAttempt)
        .filter(PracticeAttempt.session_id == session.id)
        .order_by(PracticeAttempt.attempt_number.desc())
        .all()
    )
    return [_attempt_result(attempt, questions) for attempt in attempts]


@router.post("/{invite_token}/attempts")
def start_practice_attempt(invite_token: str, db: Session = Depends(get_db)):
    session = _find_session(invite_token, db)
    questions = list(session.questions)
    if not questions:
        raise HTTPException(status_code=400, detail="This interview has no questions yet")

    latest_attempt = (
        db.query(PracticeAttempt)
        .filter(PracticeAttempt.session_id == session.id)
        .order_by(PracticeAttempt.attempt_number.desc())
        .first()
    )
    if latest_attempt and latest_attempt.status == "in_progress":
        return _attempt_result(latest_attempt, questions)

    attempt = PracticeAttempt(
        session_id=session.id,
        attempt_number=(latest_attempt.attempt_number + 1) if latest_attempt else 1,
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return _attempt_result(attempt, questions)


@router.post("/{invite_token}/attempts/{attempt_id}/answers")
async def submit_practice_answer(
    invite_token: str,
    attempt_id: int,
    payload: PracticeAnswerCreate,
    db: Session = Depends(get_db),
):
    session = _find_session(invite_token, db)
    attempt = (
        db.query(PracticeAttempt)
        .filter(
            PracticeAttempt.id == attempt_id,
            PracticeAttempt.session_id == session.id,
        )
        .first()
    )
    if attempt is None:
        raise HTTPException(status_code=404, detail="Practice attempt not found")
    if attempt.status != "in_progress":
        raise HTTPException(status_code=409, detail="This practice attempt is already complete")

    answer_text = payload.answer.strip()
    if not answer_text:
        raise HTTPException(status_code=422, detail="Write an answer before continuing")

    questions = list(session.questions)
    question_index = attempt.current_question_index
    if question_index >= len(questions):
        raise HTTPException(status_code=409, detail="This attempt has no unanswered questions")
    question = questions[question_index]
    resume_text = session.candidate.resume_text or ""

    try:
        coach = InterviewCoach(get_llm())
        feedback = await coach.evaluate_answer(
            session.jd_text,
            resume_text,
            question.text,
            answer_text,
        )
    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail="Could not score this answer. Check the LLM configuration and try again.",
        ) from error

    previous_answers = list(attempt.answers)
    answer = PracticeAnswer(
        attempt_id=attempt.id,
        question_id=question.id,
        question_text=question.text,
        answer_text=answer_text,
        score=feedback["score"],
        feedback_json=json.dumps(feedback),
    )
    attempt.answers.append(answer)
    attempt.current_question_index = question_index + 1

    if attempt.current_question_index < len(questions):
        db.commit()
        db.refresh(attempt)
        return {
            "evaluation": feedback,
            "completed": False,
            "question": {
                "id": questions[attempt.current_question_index].id,
                "text": questions[attempt.current_question_index].text,
            },
            "question_index": attempt.current_question_index,
            "question_count": len(questions),
        }

    saved_answers = previous_answers + [answer]
    answer_records = [
        {
            "question": item.question_text,
            "answer": item.answer_text,
            "score": item.score,
            "feedback": json.loads(item.feedback_json),
        }
        for item in saved_answers
    ]
    try:
        report = await coach.summarize_attempt(session.jd_text, answer_records)
    except Exception:
        report = {
            "score": round(sum(item["score"] for item in answer_records) / len(answer_records)),
            "summary": "Your practice round is complete. Review the answer-level notes and focus on the growth areas below.",
            "strengths": list(dict.fromkeys(
                point for item in answer_records for point in item["feedback"]["strengths"]
            ))[:5],
            "growth_areas": list(dict.fromkeys(
                point for item in answer_records for point in item["feedback"]["improvements"]
            ))[:5],
            "next_steps": [],
            "practice_prompt": "Retry this interview after practicing one growth area.",
        }

    attempt.status = "completed"
    attempt.score = report["score"]
    attempt.report_json = json.dumps(report)
    attempt.completed_at = datetime.now(timezone.utc)
    db.commit()
    return {
        "evaluation": feedback,
        "completed": True,
        "report": report,
        "attempt": _attempt_result(attempt, questions),
    }


@router.post("/{invite_token}/join")
async def join_interview(invite_token: str, db: Session = Depends(get_db)):
    session = (
        db.query(InterviewSession)
        .filter(InterviewSession.invite_token == invite_token)
        .first()
    )
    if session is None:
        raise HTTPException(status_code=404, detail="Invalid or expired invite link")

    if session.daily_room_url is None:
        session.daily_room_url = await create_daily_room(session.id)
        db.commit()
        db.refresh(session)

    room_name = urlparse(session.daily_room_url).path.rstrip("/").split("/")[-1]
    token = await create_daily_token(room_name, is_owner=False)

    return {"room_url": session.daily_room_url, "token": token}
