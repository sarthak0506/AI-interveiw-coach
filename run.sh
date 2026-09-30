#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
VENV_DIR="$BACKEND_DIR/venv"
PIDS=()

stop_services() {
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  for pid in "${PIDS[@]}"; do
    wait "$pid" 2>/dev/null || true
  done
}
trap stop_services EXIT INT TERM

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required. Install Python 3.11 or newer and try again." >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required. Install Node.js 18 or newer and try again." >&2
  exit 1
fi

if [[ ! -f "$BACKEND_DIR/.env" ]]; then
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
fi
if [[ ! -f "$ROOT_DIR/frontend/hr-portal/.env" ]]; then
  cp "$ROOT_DIR/frontend/hr-portal/.env.example" "$ROOT_DIR/frontend/hr-portal/.env"
fi
if [[ ! -f "$ROOT_DIR/frontend/candidate-app/.env" ]]; then
  cp "$ROOT_DIR/frontend/candidate-app/.env.example" "$ROOT_DIR/frontend/candidate-app/.env"
fi

if [[ ! -x "$VENV_DIR/bin/python" ]]; then
  python3 -m venv "$VENV_DIR"
fi
"$VENV_DIR/bin/python" -m pip install --disable-pip-version-check -r "$BACKEND_DIR/requirements.txt"

for app_dir in "$ROOT_DIR/frontend/hr-portal" "$ROOT_DIR/frontend/candidate-app"; do
  if [[ ! -d "$app_dir/node_modules" ]]; then
    (cd "$app_dir" && npm ci)
  fi
done

if grep -q '^DATABASE_URL=postgresql' "$BACKEND_DIR/.env"; then
  if ! command -v docker >/dev/null 2>&1; then
    echo "The backend .env uses PostgreSQL, but Docker is unavailable. Install Docker or set DATABASE_URL=sqlite:///./dev.db in backend/.env." >&2
    exit 1
  fi
  (cd "$ROOT_DIR" && docker compose up -d postgres)
fi

(cd "$BACKEND_DIR" && "$VENV_DIR/bin/python" -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000) &
PIDS+=("$!")
(cd "$ROOT_DIR/frontend/hr-portal" && npm run dev -- --host 0.0.0.0) &
PIDS+=("$!")
(cd "$ROOT_DIR/frontend/candidate-app" && npm run dev -- --host 0.0.0.0) &
PIDS+=("$!")

echo "HR portal:     http://localhost:5173"
echo "Candidate app: http://localhost:3000"
echo "Backend API:   http://localhost:8000/docs"
echo "Press Ctrl+C to stop all services."
wait -n "${PIDS[@]}"