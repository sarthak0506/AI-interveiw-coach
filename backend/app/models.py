# backend/app/models.py
import secrets
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
)
from sqlalchemy.orm import relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    """HR admin account."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    sessions_created = relationship("InterviewSession", back_populates="created_by_user")


class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, index=True, nullable=False)
    resume_text = Column(Text, nullable=True)  # raw/parsed resume, keep simple for now
    created_at = Column(DateTime(timezone=True), default=utcnow)

    sessions = relationship("InterviewSession", back_populates="candidate")


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    jd_text = Column(Text, nullable=False)
    status = Column(String, default="draft")  # draft | invited | in_progress | completed
    tts_provider = Column(String, default="sarvam")  # "sarvam" | "supertonic"
    stt_provider = Column(String, default="whisper")  # "whisper" | "seamless"
    invite_token = Column(String, unique=True, index=True, default=lambda: secrets.token_urlsafe(24))
    daily_room_url = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), default=utcnow)

    candidate = relationship("Candidate", back_populates="sessions")
    created_by_user = relationship("User", back_populates="sessions_created")
    questions = relationship("Question", back_populates="session", order_by="Question.order")
    transcript_entries = relationship("Transcript", back_populates="session")
    assessment = relationship("SessionAssessment", back_populates="session", uselist=False)
    practice_attempts = relationship("PracticeAttempt", back_populates="session")

    @property
    def match_score(self) -> int | None:
        return self.assessment.match_score if self.assessment else None

    @property
    def match_report(self) -> dict | None:
        if not self.assessment:
            return None
        import json

        return json.loads(self.assessment.report_json)


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("interview_sessions.id"), nullable=False)

    text = Column(Text, nullable=False)
    type = Column(String, default="behavioral")  # depth_probe | gap_check | behavioral
    order = Column(Integer, default=0)

    session = relationship("InterviewSession", back_populates="questions")


class Transcript(Base):
    __tablename__ = "transcripts"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("interview_sessions.id"), nullable=False)

    speaker = Column(String, nullable=False)  # "candidate" | "bot"
    text = Column(Text, nullable=False)
    timestamp = Column(DateTime(timezone=True), default=utcnow)

    session = relationship("InterviewSession", back_populates="transcript_entries")


class SessionAssessment(Base):
    __tablename__ = "session_assessments"

    session_id = Column(Integer, ForeignKey("interview_sessions.id"), primary_key=True)
    match_score = Column(Integer, nullable=False)
    report_json = Column(Text, nullable=False)

    session = relationship("InterviewSession", back_populates="assessment")


class PracticeAttempt(Base):
    __tablename__ = "practice_attempts"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("interview_sessions.id"), nullable=False, index=True)
    attempt_number = Column(Integer, nullable=False)
    current_question_index = Column(Integer, default=0, nullable=False)
    status = Column(String, default="in_progress", nullable=False)
    score = Column(Integer, nullable=True)
    report_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    session = relationship("InterviewSession", back_populates="practice_attempts")
    answers = relationship("PracticeAnswer", back_populates="attempt", order_by="PracticeAnswer.id")


class PracticeAnswer(Base):
    __tablename__ = "practice_answers"

    id = Column(Integer, primary_key=True, index=True)
    attempt_id = Column(Integer, ForeignKey("practice_attempts.id"), nullable=False, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    question_text = Column(Text, nullable=False)
    answer_text = Column(Text, nullable=False)
    score = Column(Integer, nullable=False)
    feedback_json = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    attempt = relationship("PracticeAttempt", back_populates="answers")
