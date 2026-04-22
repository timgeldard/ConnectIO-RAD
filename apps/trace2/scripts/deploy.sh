#!/usr/bin/env bash
# deploy.sh
#
# End-to-end deploy for trace2 — replaces `make deploy` on hosts without make.
# Runs:
#   1. databricks auth check
#   2. frontend build (produces frontend/dist/)
#   3. render app.yaml from template
#   4. databricks bundle deploy --profile <profile>
#   5. post-deploy snapshot + re-apply user_api_scopes: ["sql"]
#
# Usage:
#   bash scripts/deploy.sh                  # defaults to uat
#   bash scripts/deploy.sh --profile prod
#
# Prerequisites: databricks CLI >= 0.220, node + npm, envsubst (GNU gettext).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

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

cd "$REPO_ROOT"

echo "→ 1/5  checking Databricks auth (profile: $PROFILE)..."
if ! databricks current-user me --profile "$PROFILE" -o json > /dev/null 2>&1; then
  echo "ERROR: cannot authenticate with Databricks." >&2
  echo "       run: databricks configure --profile $PROFILE" >&2
  exit 1
fi
echo "✓ auth OK"

echo "→ 2/5  building frontend..."
(cd frontend && npm run build)

echo "→ 3/5  rendering app.yaml..."
bash "$SCRIPT_DIR/render-app-yaml.sh"

echo "→ 4/5  databricks bundle deploy --profile $PROFILE..."
databricks bundle deploy --profile "$PROFILE"

echo "→ 5/5  post-deploy (snapshot + user_api_scopes)..."
APP_NAME="$APP_NAME" BUNDLE_NAME="$BUNDLE_NAME" bash "$SCRIPT_DIR/post-deploy.sh" --profile "$PROFILE"

echo ""
echo "✓ deploy complete (profile: $PROFILE)"
