#!/usr/bin/env bash
# render-app-yaml.sh
#
# Renders app.yaml from app.template.yaml by substituting the three env vars
# that parameterise the Databricks Apps runtime config.
#
# Runs safely on Git Bash / MSYS by disabling the automatic Win32 path mangling
# that otherwise turns /sql/1.0/warehouses/... into C:/...
#
# Usage:
#   bash scripts/render-app-yaml.sh
#
# Environment overrides (optional):
#   DATABRICKS_WAREHOUSE_HTTP_PATH   default /sql/1.0/warehouses/e76480b94bea6ed5
#   TRACE_CATALOG                    default connected_plant_uat
#   TRACE_SCHEMA                     default gold

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

export DATABRICKS_WAREHOUSE_HTTP_PATH="${DATABRICKS_WAREHOUSE_HTTP_PATH:-/sql/1.0/warehouses/e76480b94bea6ed5}"
export TRACE_CATALOG="${TRACE_CATALOG:-connected_plant_uat}"
export TRACE_SCHEMA="${TRACE_SCHEMA:-gold}"

export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'

envsubst '$DATABRICKS_WAREHOUSE_HTTP_PATH $TRACE_CATALOG $TRACE_SCHEMA' \
  < "$REPO_ROOT/app.template.yaml" > "$REPO_ROOT/app.yaml"

echo "✓ Rendered app.yaml"
echo "  DATABRICKS_WAREHOUSE_HTTP_PATH=$DATABRICKS_WAREHOUSE_HTTP_PATH"
echo "  TRACE_CATALOG=$TRACE_CATALOG"
echo "  TRACE_SCHEMA=$TRACE_SCHEMA"
