"""Quick schema probe for the gold views used by RecallReadiness.

Usage:
  DATABRICKS_CONFIG_PROFILE=uat python scripts/probe_schema.py
"""
import json
import os
import subprocess
import sys

VIEWS = [
    "gold_batch_lineage",
    "gold_material",
    "gold_plant",
    "gold_batch_stock_mat",
    "gold_batch_mass_balance_mat",
    "gold_batch_delivery_mat",
    "gold_batch_quality_summary_v",
]

CATALOG = os.environ.get("TRACE_CATALOG", "connected_plant_uat")
SCHEMA = os.environ.get("TRACE_SCHEMA", "gold")
WAREHOUSE_ID = os.environ.get("WAREHOUSE_ID", "e76480b94bea6ed5")
PROFILE = os.environ.get("DATABRICKS_CONFIG_PROFILE", "uat")


def main():
    view_list = ", ".join(f"'{v}'" for v in VIEWS)
    stmt = (
        "SELECT table_name, column_name, data_type, ordinal_position "
        "FROM system.information_schema.columns "
        f"WHERE table_catalog = '{CATALOG}' AND table_schema = '{SCHEMA}' "
        f"AND table_name IN ({view_list}) "
        "ORDER BY table_name, ordinal_position"
    )
    body = json.dumps({
        "warehouse_id": WAREHOUSE_ID,
        "statement": stmt,
        "wait_timeout": "50s",
    })
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
        print(json.dumps(payload, indent=2), file=sys.stderr)
        sys.exit(2)

    cols = [c["name"] for c in payload["manifest"]["schema"]["columns"]]
    by_tbl: dict[str, list[tuple[str, str]]] = {}
    for row in payload.get("result", {}).get("data_array", []):
        rec = dict(zip(cols, row))
        by_tbl.setdefault(rec["table_name"], []).append(
            (rec["column_name"], rec["data_type"])
        )
    for v in VIEWS:
        print(f"=== {v} ===")
        for name, ty in by_tbl.get(v, []):
            print(f"  {name:40} {ty}")
        if v not in by_tbl:
            print("  (no columns — view not found in information_schema)")
        print()


if __name__ == "__main__":
    main()
