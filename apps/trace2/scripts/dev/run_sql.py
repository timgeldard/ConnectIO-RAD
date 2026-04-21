"""Minimal SQL probe helper.

Usage:
  DATABRICKS_CONFIG_PROFILE=uat python scripts/run_sql.py "SELECT 1"
"""
import json
import os
import subprocess
import sys

WAREHOUSE_ID = os.environ.get("WAREHOUSE_ID", "e76480b94bea6ed5")
PROFILE = os.environ.get("DATABRICKS_CONFIG_PROFILE", "uat")


def main() -> None:
    if len(sys.argv) < 2:
        print("usage: run_sql.py <statement>", file=sys.stderr)
        sys.exit(2)
    stmt = sys.argv[1]
    body = json.dumps({"warehouse_id": WAREHOUSE_ID, "statement": stmt, "wait_timeout": "50s"})
    result = subprocess.run(
        ["databricks", "api", "post", "/api/2.0/sql/statements/", "--profile", PROFILE, "--json", body],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        print("CLI failed:", result.stderr, file=sys.stderr)
        sys.exit(1)
    payload = json.loads(result.stdout)
    state = payload.get("status", {}).get("state")
    if state != "SUCCEEDED":
        print(json.dumps(payload.get("status", {}), indent=2), file=sys.stderr)
        sys.exit(2)
    cols = [c["name"] for c in payload["manifest"]["schema"]["columns"]]
    rows = payload.get("result", {}).get("data_array", []) or []
    print("\t".join(cols))
    for r in rows:
        print("\t".join("" if v is None else str(v) for v in r))


if __name__ == "__main__":
    main()
