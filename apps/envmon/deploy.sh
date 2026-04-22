#!/usr/bin/env bash
# envmon deploy entry point.
#
# Usage: bash deploy.sh [PROFILE] [TARGET]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

PROFILE="${1:-uat}"
TARGET="${2:-uat}"

python3 "$REPO_ROOT/scripts/deploy_app.py" \
  --app-dir "$SCRIPT_DIR" \
  --profile "$PROFILE" \
  --target "$TARGET"
