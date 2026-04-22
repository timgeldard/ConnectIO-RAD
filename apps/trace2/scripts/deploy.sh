#!/usr/bin/env bash
# End-to-end deploy for trace2.
#
# Usage:
#   bash scripts/deploy.sh
#   bash scripts/deploy.sh --profile prod

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$APP_DIR/../.." && pwd)"

PROFILE="uat"
APP_NAME="${APP_NAME:-trace2}"
BUNDLE_NAME="${BUNDLE_NAME:-trace2}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile) PROFILE="$2"; shift 2 ;;
    --app-name) APP_NAME="$2"; shift 2 ;;
    --bundle-name) BUNDLE_NAME="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--profile uat|prod] [--app-name NAME] [--bundle-name NAME]"
      exit 0
      ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

python3 "$REPO_ROOT/scripts/deploy_app.py" \
  --app-dir "$APP_DIR" \
  --profile "$PROFILE" \
  --app-name "$APP_NAME" \
  --bundle-name "$BUNDLE_NAME"
