import json

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.agents.coach import InterviewCoach
from app.agents.documents import extract_document_text
from app.agents.llm import get_llm
from app.config import settings
from app.deps import get_current_user, get_db
from app.models import InterviewSession, Candidate, Question, SessionAssessment, User
from app.schemas import SessionCreate, SessionOut, QuestionCreate, QuestionOut

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("/analyze")
async def analyze_documents(
    job_description: UploadFile = File(...),
    resume: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not settings.llm_api_key:
        raise HTTPException(status_code=503, detail="LLM_API_KEY is not configured")

    jd_text = await extract_document_text(job_description)
    resume_text = await extract_document_text(resume)
    try:
        assessment = await InterviewCoach(get_llm()).analyze_documents(jd_text, resume_text)
    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail="Document analysis failed. Check the LLM configuration and try again.",
        ) from error

    return {
        "jd_text": jd_text,
        "resume_text": resume_text,
        "assessment": assessment,
    }


@router.post("", response_model=SessionOut)
def create_session(
    payload: SessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
            resume_text=payload.resume_text,
        )
        db.add(candidate)
        db.flush()
    else:
        candidate.name = payload.candidate_name
        if payload.resume_text:
            candidate.resume_text = payload.resume_text

    session = InterviewSession(
        candidate_id=candidate.id,
        created_by=current_user.id,
        jd_text=payload.jd_text,
        tts_provider=payload.tts_provider,
        stt_provider=payload.stt_provider,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    if payload.assessment:
        assessment_data = payload.assessment
        report = {
            key: assessment_data.get(key)
            for key in ("summary", "strengths", "gaps", "study_plan")
        }
        db.add(SessionAssessment(
            session_id=session.id,
            match_score=max(0, min(100, int(assessment_data.get("score", 0)))),
            report_json=json.dumps(report),
        ))
        db.commit()
        db.refresh(session)
    return session


@router.post("/{session_id}/questions", response_model=QuestionOut)
def add_question(
    session_id: int,
    payload: QuestionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = (
        db.query(InterviewSession)
        .filter(
            InterviewSession.id == session_id,
            InterviewSession.created_by == current_user.id,
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
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(InterviewSession)
        .filter(InterviewSession.created_by == current_user.id)
        .order_by(InterviewSession.created_at.desc())
        .all()
    )
