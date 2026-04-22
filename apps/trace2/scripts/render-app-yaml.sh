#!/usr/bin/env bash
# Render trace2 app.yaml from app.template.yaml.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$APP_DIR/../.." && pwd)"

python3 "$REPO_ROOT/scripts/deploy_app.py" \
  --app-dir "$APP_DIR" \
  --action render
