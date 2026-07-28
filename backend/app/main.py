from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers import auth, sessions, interview

# no Alembic yet — this auto-creates tables on startup, fine for dev.
# swap to proper migrations before this touches a real production database.
Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI Interview Coach API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(sessions.router)
app.include_router(interview.router)

@app.get("/")
def root():
    return {"status": "ok"}
