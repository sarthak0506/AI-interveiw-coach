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
      sessions.py        # /sessions — students create their own practice plans
      interview.py       # private practice, speech, reports, and legacy invite preview
    agents/              # interview AI logic
      llm.py             # LLM client (Gemini primary, Groq fallback)
      interviewer_agent.py  # follow-up vs. next-question decision loop
      stt.py             # speech-to-text (Whisper/Seamless local, Groq fallback)
      tts.py             # text-to-speech (Supertonic/Sarvam, ElevenLabs fallback)
      room.py            # Daily.co room + token creation
      prompts/
  test_llm_interviewer.py  # manual script: exercises the LLM + agent loop
  test_tts_comparison.py   # manual script: benchmarks Supertonic vs. Sarvam
frontend/
  hr-portal/             # unified student login, preparation, practice (port 5173)
  candidate-app/         # redirects old links to the unified student workspace
docker-compose.yml       # Postgres 16 for local dev
```

## Prerequisites

- Python 3.11+
- Node 18+
- Postgres — either via Docker Compose below, or use SQLite for zero setup

## Quick start

On macOS or Linux, run all three apps with:

```bash
./run.sh
```

The script creates the Python virtual environment and keeps backend dependencies
in sync on each run. The local backend `.env` uses SQLite, so Docker is not required.
Add provider API keys to `backend/.env` to enable AI voice features.

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

## 3. Student workspace

The student workspace is the single frontend. It reads `VITE_API_URL` from
`frontend/hr-portal/.env` (defaults documented in `.env.example`).

```bash
cd frontend/hr-portal
npm install
cp .env.example .env
npm run dev                    # http://localhost:5173
```

`npm run build` emits to `dist/`; `npm run preview` serves that build.

## Resume-based practice

Create one student account and sign in to the student workspace. Accept the
practice-data consent during registration. Upload a text-based PDF, DOCX, or TXT
job description and resume (8 MB maximum each). The Gemini model configured by `LLM_API_KEY`
estimates role alignment, highlights strengths and learning gaps, and drafts
editable interview questions. Create the session to get a candidate invite
link.

The student starts practice directly in the same signed-in workspace. They can
listen to a question and record an answer; the transcript is editable before it
is submitted for coaching. If audio capture or a configured speech provider is
unavailable, students can answer by typing. Each answer receives a score and
coaching notes; the final report gives next steps, and additional rounds are
saved so the student can compare progress. Session data is scoped to the
account. Students can export or delete their account and practice data. Scores
are educational estimates, not hiring decisions.

Each answer is scored on role relevance, specific evidence, answer structure,
and clarity. Each dimension is scored from 0 to 10 and weighted equally in the
overall practice score. The report shows the evidence notes for each dimension
so students can see what informed the score and what to try next.

## Manual test scripts

Run from `backend/` with the venv active — these hit live APIs and need the
matching keys in `.env`:

```bash
python test_llm_interviewer.py    # needs LLM_API_KEY / FALLBACK_API_KEY
python test_tts_comparison.py     # needs a local Supertonic server + SARVAM_API_KEY
```

## Phases

1. **Phase 0** (done): repo scaffold, database models, and authentication
2. **Phase 1** (done): one student workspace, consent, account-scoped practice data,
  export, and deletion
3. **Phase 2** (done): transparent educational rubric, evidence notes, and
  dimension-level progress across practice rounds
4. **Phase 3** (in progress): voice-enabled practice with editable
  transcription and spoken question prompts
5. **Phase 4**: scheduling and study-plan reminders
6. **Phase 5**: optional instructor sharing and cohort progress tools
