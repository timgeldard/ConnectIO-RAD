#!/usr/bin/env bash
# Local dev: starts FastAPI (port 8000) + Vite (port 5173) with vite proxying /api.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cleanup() {
  jobs -p | xargs -r kill 2>/dev/null || true
}
trap cleanup EXIT

(cd "$ROOT" && APP_ENV=development uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload) &
(cd "$ROOT/frontend" && npm run dev) &

wait
