from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import InterviewSession
from app.schemas import InterviewSessionOut

router = APIRouter(prefix="/interview", tags=["interview"])


@router.get("/{invite_token}", response_model=InterviewSessionOut)
def get_interview_by_token(invite_token: str, db: Session = Depends(get_db)):
    """
    Public endpoint — no auth. The candidate app hits this with the token
    from their invite link to load the JD + question list.
    """
    session = (
        db.query(InterviewSession)
        .filter(InterviewSession.invite_token == invite_token)
        .first()
    )
    if session is None:
        raise HTTPException(status_code=404, detail="Invalid or expired invite link")

    return session
