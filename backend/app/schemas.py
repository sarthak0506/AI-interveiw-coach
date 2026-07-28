from datetime import datetime
from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str


class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    created_at: datetime

    class Config:
        from_attributes = True  # lets this build directly from a SQLAlchemy User object


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    email: str | None = None

# ---------- Sessions (HR-side) ----------

class SessionCreate(BaseModel):
    jd_text: str
    candidate_name: str
    candidate_email: str


class SessionOut(BaseModel):
    id: int
    candidate_id: int
    jd_text: str
    status: str
    invite_token: str
    created_at: datetime

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


# ---------- Interview (candidate-side) ----------

class InterviewSessionOut(BaseModel):
    jd_text: str
    status: str
    questions: list[QuestionOut]

    class Config:
        from_attributes = True
