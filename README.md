# AI Interview Coach

Real-time AI voice interview system, built phase by phase.

## Layout

```
backend/
  app/
    config.py            # settings, loaded from .env
    database.py          # SQLAlchemy engine/session
    models.py            # User, InterviewSession, Question
    schemas.py           # Pydantic request/response shapes
    auth.py              # password hashing + JWT helpers
    deps.py              # shared FastAPI dependencies
    main.py              # FastAPI app entrypoint
    routers/
      auth.py            # /auth/register, /auth/login, /auth/me
      sessions.py        # /sessions — HR creates sessions + questions
      interview.py       # /interview/{invite_token} — candidate join + Daily room
    agents/              # interview AI logic
      llm.py             # LLM client (OpenRouter primary, Groq fallback)
      interviewer_agent.py  # follow-up vs. next-question decision loop
      stt.py             # speech-to-text (Whisper/Seamless local, Groq fallback)
      tts.py             # text-to-speech (Supertonic/Sarvam, ElevenLabs fallback)
      room.py            # Daily.co room + token creation
      prompts/
  test_llm_interviewer.py  # manual script: exercises the LLM + agent loop
  test_tts_comparison.py   # manual script: benchmarks Supertonic vs. Sarvam
frontend/
  hr-portal/             # HR: login, create sessions, draft questions  (port 5173)
  candidate-app/         # candidate: join call, camera/mic, talk to the AI (port 3000)
docker-compose.yml       # Postgres 16 for local dev
```

## Prerequisites

- Python 3.11+
- Node 18+
- Postgres — either via Docker Compose below, or use SQLite for zero setup

## 1. Database

With Docker (Postgres on host port **5433**, matching `.env.example`):

```bash
docker compose up -d
```

No Docker? Skip it and point `DATABASE_URL` at SQLite in your `.env`:

```
DATABASE_URL=sqlite:///./dev.db
```

Tables are auto-created on API startup (`Base.metadata.create_all`) — there is
no Alembic yet.

## 2. Backend

```powershell
cd backend
python -m venv venv
venv\Scripts\activate          # source venv/bin/activate on macOS/Linux
pip install -r requirements.txt
copy .env.example .env         # cp on macOS/Linux — then set JWT_SECRET
uvicorn app.main:app --reload
```

API on http://localhost:8000, interactive docs at http://localhost:8000/docs.

Set a real `JWT_SECRET` in `.env` before doing anything beyond local poking.
The LLM/STT/TTS keys are only needed for the voice phases — auth, sessions, and
question drafting work without them.

## 3. Frontends

Two separate Vite apps, each in its own terminal. Both read `VITE_API_URL`
(defaults documented in each `.env.example`).

```bash
cd frontend/hr-portal
npm install
cp .env.example .env
npm run dev                    # http://localhost:5173
```

```bash
cd frontend/candidate-app
npm install
cp .env.example .env
npm run dev                    # http://localhost:3000
```

Both ports are already in the backend's CORS allowlist. `npm run build` emits
to `dist/`, `npm run preview` serves that build.

## Manual test scripts

Run from `backend/` with the venv active — these hit live APIs and need the
matching keys in `.env`:

```bash
python test_llm_interviewer.py    # needs LLM_API_KEY / FALLBACK_API_KEY
python test_tts_comparison.py     # needs a local Supertonic server + SARVAM_API_KEY
```

## Phases

1. **Phase 0** (done): repo scaffold, DB models, JWT auth
2. **Phase 1** (done): HR portal — session creation, question drafting, invite links
3. **Phase 2** (done): Candidate app — join screen, camera/mic, Daily call room
4. **Phase 3**: Interview bot v1 — bot joins the call, reads admin questions in order
5. **Phase 4** (in progress): Interview bot v2 — LLM cross-questioning loop
   (`interviewer_agent.py` is built; `stt.py` is not wired into the call yet)
6. **Phase 5**: Recording + transcript storage + HR report view
7. **Phase 6**: Hook up resume/JD-matching endpoints to auto-draft questions
