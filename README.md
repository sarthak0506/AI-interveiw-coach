# AI Interview Coach

Real-time AI voice interview system, built phase by phase.

## Layout

```
backend/
  app/
    config.py        # settings, loaded from .env (DONE)
    database.py       # SQLAlchemy engine/session (DONE)
    models.py         # DB models — User etc. (TODO, Phase 0 continued)
    schemas.py         # Pydantic request/response shapes (TODO)
    auth.py             # password hashing + JWT helpers (TODO)
    main.py              # FastAPI app entrypoint (TODO)
    routers/
      auth.py               # /auth/register, /auth/login, /auth/me (TODO)
    agents/                  # all interview AI logic lives here — later phases
      prompts/
frontend/
  hr-portal/            # HR page: JD upload, questions, candidate review, reports (Phase 1)
  candidate-app/        # candidate page: join call, camera/mic, talk to the AI (Phase 2)
requirements.txt
```

No Docker for now — run Postgres (or SQLite for zero-setup local dev) and the
API directly with `uvicorn`.

## Phase 0 — what's here so far

- `backend/app/config.py` — settings object (`database_url`, `jwt_secret`, etc.)
- `backend/app/database.py` — SQLAlchemy engine + session factory
- Everything else in `backend/app/` (models, schemas, auth, routers/auth.py,
  main.py) is scaffolded as empty files/folders — build these next, using
  the Gemini prompt from our conversation, or continue with me.

## Running once Phase 0 code exists

```bash
cd backend
python -m venv venv
source venv/bin/activate        # venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env            # set your own JWT_SECRET
uvicorn app.main:app --reload
```

API docs will be at `http://localhost:8000/docs`.

## Phases

1. **Phase 0** (in progress): repo scaffold, DB models, JWT auth
2. **Phase 1**: HR portal — JD upload, question drafting, candidate invite links
3. **Phase 2**: Candidate app — join screen, camera/mic, Meet-style call room
4. **Phase 3**: Interview bot v1 — Pipecat joins the call, reads admin questions in order
5. **Phase 4**: Interview bot v2 — LLM cross-questioning/follow-up decision loop
6. **Phase 5**: Recording + transcript storage + HR report view
7. **Phase 6**: Hook up resume/JD-matching endpoints to auto-draft questions
