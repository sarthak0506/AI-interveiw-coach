from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.models import InterviewSession, InviteAccess, utcnow


def create_invite_access(session_id: int) -> InviteAccess:
    return InviteAccess(
        session_id=session_id,
        expires_at=utcnow() + timedelta(days=settings.invite_validity_days),
    )


def get_or_create_invite_access(session: InterviewSession, db: Session) -> InviteAccess:
    access = session.invite_access
    if access is None:
        created_at = session.created_at or utcnow()
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        access = InviteAccess(
            session_id=session.id,
            expires_at=created_at + timedelta(days=settings.invite_validity_days),
        )
        db.add(access)
        db.flush()
    return access


def ensure_invite_active(session: InterviewSession, db: Session) -> InviteAccess:
    access = get_or_create_invite_access(session, db)
    expires_at = access.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if access.revoked_at is not None:
        raise HTTPException(status_code=410, detail="This interview invite has been revoked")
    if expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="This interview invite has expired")
    return access