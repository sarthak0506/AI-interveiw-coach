from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.agents.room import create_daily_room, create_daily_token
from app.deps import get_db
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
