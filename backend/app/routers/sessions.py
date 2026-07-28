from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import InterviewSession, Candidate, Question
from app.schemas import SessionCreate, SessionOut, QuestionCreate, QuestionOut

router = APIRouter(prefix="/sessions", tags=["sessions"])


# TEMPORARY — replace with real app.deps.get_current_user once backend/auth merges
def get_current_user():
    return {"id": 1, "email": "dev@test.com"}


@router.post("", response_model=SessionOut)
def create_session(
    payload: SessionCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    candidate = (
        db.query(Candidate)
        .filter(Candidate.email == payload.candidate_email)
        .first()
    )
    if candidate is None:
        candidate = Candidate(
            name=payload.candidate_name,
            email=payload.candidate_email,
        )
        db.add(candidate)
        db.flush()

    session = InterviewSession(
        candidate_id=candidate.id,
        created_by=current_user["id"],
        jd_text=payload.jd_text,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.post("/{session_id}/questions", response_model=QuestionOut)
def add_question(
    session_id: int,
    payload: QuestionCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    session = (
        db.query(InterviewSession)
        .filter(
            InterviewSession.id == session_id,
            InterviewSession.created_by == current_user["id"],
        )
        .first()
    )
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    order = payload.order
    if order is None:
        order = db.query(Question).filter(Question.session_id == session_id).count()

    question = Question(
        session_id=session_id,
        text=payload.text,
        type=payload.type,
        order=order,
    )
    db.add(question)
    db.commit()
    db.refresh(question)
    return question


@router.get("", response_model=list[SessionOut])
def list_sessions(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return (
        db.query(InterviewSession)
        .filter(InterviewSession.created_by == current_user["id"])
        .order_by(InterviewSession.created_at.desc())
        .all()
    )
