from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    full_name: str
    consent: bool


class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    email: str | None = None


class SessionCreate(BaseModel):
    jd_text: str
    resume_text: str | None = None
    assessment: dict | None = None
    tts_provider: Literal["sarvam", "supertonic"] = "sarvam"
    stt_provider: Literal["whisper", "seamless"] = "whisper"


class SessionOut(BaseModel):
    id: int
    candidate_id: int
    jd_text: str
    status: str
    tts_provider: Literal["sarvam", "supertonic"]
    stt_provider: Literal["whisper", "seamless"]
    created_at: datetime
    match_score: int | None = None
    match_report: dict | None = None

    class Config:
        from_attributes = True


class QuestionCreate(BaseModel):
    text: str
    type: str = "behavioral"
    order: int | None = None


class QuestionOut(BaseModel):
    id: int
    session_id: int
    text: str
    type: str
    order: int

    class Config:
        from_attributes = True


class SessionDetailOut(SessionOut):
    questions: list[QuestionOut]


class InterviewSessionOut(BaseModel):
    jd_text: str
    status: str
    questions: list[QuestionOut]

    class Config:
        from_attributes = True


class PracticeAnswerCreate(BaseModel):
    answer: str = Field(min_length=1, max_length=12000)


class PracticeSpeechRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
