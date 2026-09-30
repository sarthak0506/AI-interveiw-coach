import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.auth import create_access_token, hash_password, verify_password
from app.deps import get_current_user, get_db
from app.models import (
    Candidate,
    InterviewSession,
    InviteAccess,
    PracticeAnswer,
    PracticeAttempt,
    PracticeConsent,
    Question,
    SessionAssessment,
    Transcript,
    User,
)
from app.schemas import Token, UserCreate, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])
CONSENT_VERSION = "student-practice-v1"


@router.post("/register", response_model=UserOut)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    if not payload.consent:
        raise HTTPException(status_code=400, detail="Consent is required to save practice data")

    email = str(payload.email).casefold()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.flush()
    db.add(PracticeConsent(
        user_id=user.id,
        consent_at=datetime.now(timezone.utc),
        consent_version=CONSENT_VERSION,
    ))
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username.casefold()).first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": user.email})
    return Token(access_token=access_token)


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/me/export")
def export_student_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sessions = (
        db.query(InterviewSession)
        .filter(InterviewSession.created_by == current_user.id)
        .order_by(InterviewSession.created_at.desc())
        .all()
    )
    consent = db.query(PracticeConsent).filter(
        PracticeConsent.user_id == current_user.id
    ).first()
    return {
        "exported_at": datetime.now(timezone.utc),
        "consent_version": consent.consent_version if consent else None,
        "student": {"name": current_user.full_name, "email": current_user.email},
        "sessions": [
            {
                "id": session.id,
                "job_description": session.jd_text,
                "match_score": session.match_score,
                "match_report": session.match_report,
                "resume_text": session.candidate.resume_text,
                "questions": [question.text for question in session.questions],
                "attempts": [
                    {
                        "attempt_number": attempt.attempt_number,
                        "status": attempt.status,
                        "score": attempt.score,
                        "report": json.loads(attempt.report_json) if attempt.report_json else None,
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
                    for attempt in session.practice_attempts
                ],
            }
            for session in sessions
        ],
    }


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_student_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sessions = db.query(InterviewSession).filter(
        InterviewSession.created_by == current_user.id
    ).all()
    session_ids = [session.id for session in sessions]
    candidate_ids = {session.candidate_id for session in sessions}
    attempt_ids = [
        row.id for row in db.query(PracticeAttempt.id)
        .filter(PracticeAttempt.session_id.in_(session_ids)).all()
    ] if session_ids else []

    if attempt_ids:
        db.query(PracticeAnswer).filter(PracticeAnswer.attempt_id.in_(attempt_ids)).delete(
            synchronize_session=False
        )
    if session_ids:
        db.query(PracticeAttempt).filter(PracticeAttempt.session_id.in_(session_ids)).delete(
            synchronize_session=False
        )
        db.query(Transcript).filter(Transcript.session_id.in_(session_ids)).delete(
            synchronize_session=False
        )
        db.query(Question).filter(Question.session_id.in_(session_ids)).delete(
            synchronize_session=False
        )
        db.query(SessionAssessment).filter(SessionAssessment.session_id.in_(session_ids)).delete(
            synchronize_session=False
        )
        db.query(InviteAccess).filter(InviteAccess.session_id.in_(session_ids)).delete(
            synchronize_session=False
        )
        db.query(InterviewSession).filter(InterviewSession.id.in_(session_ids)).delete(
            synchronize_session=False
        )

    for candidate_id in candidate_ids:
        other_sessions = db.query(InterviewSession.id).filter(
            InterviewSession.candidate_id == candidate_id
        ).first()
        if other_sessions is None:
            db.query(Candidate).filter(Candidate.id == candidate_id).delete(
                synchronize_session=False
            )

    db.query(PracticeConsent).filter(PracticeConsent.user_id == current_user.id).delete(
        synchronize_session=False
    )
    db.delete(current_user)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)