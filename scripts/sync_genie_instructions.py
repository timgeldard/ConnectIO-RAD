#!/usr/bin/env python3
"""Sync Genie Space instructions from the repository to Databricks.

Reads instruction YAML/Markdown/SQL files from apps/<app>/genie/ and calls the
Databricks Lakeview API to create or update the space's instruction set.

Usage (via deploy_app.py after_bundle hook, or standalone):
    python3 scripts/sync_genie_instructions.py --app-dir apps/processorderhistory --profile prod

The script is idempotent: existing instructions are matched by title and updated
in-place; new instructions are created. Deleted files do not remove remote
instructions — remove manually via the Genie UI or add a --prune flag later.

Environment variables (set by deploy_app.py / databricks.yml):
    DATABRICKS_HOST       Workspace URL  (e.g. https://adb-xxx.azuredatabricks.net)
    GENIE_SPACE_ID        Genie Space ID from the workspace URL
    DATABRICKS_TOKEN      PAT or OAuth token  (set by databricks-cli auth)

API note: The Lakeview / AI-BI space management API is available at
    PUT /api/2.0/lakeview/spaces/{space_id}
and requires CAN_MANAGE permission on the space.
If the workspace does not yet support this endpoint, use the Genie UI and treat
the files in genie/ as the source-of-truth documentation for manual entry.
"""
import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Optional
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import yaml

# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--app-dir", required=True, help="Path to the app directory (e.g. apps/processorderhistory)")
    p.add_argument("--profile", default="DEFAULT", help="Databricks CLI profile for token resolution")
    p.add_argument("--dry-run", action="store_true", help="Print what would be synced without calling the API")
    return p.parse_args()


# ---------------------------------------------------------------------------
# Token + host resolution
# ---------------------------------------------------------------------------

def resolve_token(profile: str) -> str:
    """Resolve a Databricks bearer token via CLI or environment variable."""
    token = os.environ.get("DATABRICKS_TOKEN")
    if token:
        return token
    try:
        result = subprocess.run(
            ["databricks", "auth", "token", "--profile", profile],
            capture_output=True, text=True, check=True,
        )
        return result.stdout.strip()
    except (subprocess.CalledProcessError, FileNotFoundError) as exc:
        sys.exit(f"[sync_genie] Could not resolve Databricks token: {exc}")


def resolve_host() -> str:
    host = os.environ.get("DATABRICKS_HOST", "").rstrip("/")
    if not host:
        sys.exit("[sync_genie] DATABRICKS_HOST environment variable is not set.")
    if not host.startswith(("http://", "https://")):
        host = f"https://{host}"
    return host


def resolve_space_id() -> str:
    space_id = os.environ.get("GENIE_SPACE_ID", "")
    if not space_id:
        sys.exit("[sync_genie] GENIE_SPACE_ID environment variable is not set.")
    return space_id


# ---------------------------------------------------------------------------
# API helpers
# ---------------------------------------------------------------------------

def _api(method: str, path: str, token: str, body: Optional[dict] = None) -> dict:
    host = resolve_host()
    url = f"{host}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = Request(url, data=data, method=method, headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    })
    try:
        with urlopen(req, timeout=30) as resp:
            raw = resp.read()
        return json.loads(raw) if raw else {}
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace") or exc.reason
        sys.exit(f"[sync_genie] API error {exc.code}: {detail}")
    except URLError as exc:
        sys.exit(f"[sync_genie] Cannot reach Databricks: {exc.reason}")


# ---------------------------------------------------------------------------
# Instruction loading
# ---------------------------------------------------------------------------

def load_text_instructions(genie_dir: Path) -> list[dict]:
    """Load all Markdown instruction files from genie/instructions/."""
    instructions = []
    inst_dir = genie_dir / "instructions"
    if not inst_dir.exists():
        return instructions
    for md_file in sorted(inst_dir.glob("*.md")):
        content = md_file.read_text(encoding="utf-8").strip()
        title = md_file.stem.lstrip("0123456789_")  # strip leading number prefix
        instructions.append({"type": "text", "title": title, "content": content, "file": str(md_file)})
    return instructions


def load_joins(genie_dir: Path) -> list[dict]:
    """Load join definitions from genie/joins/joins.yaml."""
    joins_file = genie_dir / "joins" / "joins.yaml"
    if not joins_file.exists():
        return []
    data = yaml.safe_load(joins_file.read_text(encoding="utf-8"))
    return data.get("joins", [])


def load_expressions(genie_dir: Path) -> list[dict]:
    """Load named SQL expressions from genie/expressions/expressions.yaml."""
    expr_file = genie_dir / "expressions" / "expressions.yaml"
    if not expr_file.exists():
        return []
    data = yaml.safe_load(expr_file.read_text(encoding="utf-8"))
    return data.get("expressions", [])


def load_queries(genie_dir: Path) -> list[dict]:
    """Load trusted SQL queries from genie/queries/*.sql."""
    queries = []
    queries_dir = genie_dir / "queries"
    if not queries_dir.exists():
        return queries
    for sql_file in sorted(queries_dir.glob("*.sql")):
        sql = sql_file.read_text(encoding="utf-8").strip()
        # Extract the first comment line as the title
        title_line = next((ln.lstrip("- ").strip() for ln in sql.splitlines() if ln.startswith("--")), sql_file.stem)
        queries.append({"title": title_line, "sql": sql, "file": str(sql_file)})
    return queries


# ---------------------------------------------------------------------------
# Sync
# ---------------------------------------------------------------------------

def sync(genie_dir: Path, token: str, space_id: str, dry_run: bool) -> None:
    text_instructions = load_text_instructions(genie_dir)
    joins = load_joins(genie_dir)
    expressions = load_expressions(genie_dir)
    queries = load_queries(genie_dir)

    print(f"[sync_genie] Loaded from {genie_dir}:")
    print(f"  {len(text_instructions)} text instructions")
    print(f"  {len(joins)} join definitions")
    print(f"  {len(expressions)} SQL expressions")
    print(f"  {len(queries)} trusted SQL queries")

    if dry_run:
        print("[sync_genie] Dry run -- no API calls made.")
        for inst in text_instructions:
            print(f"  [text] {inst['title']}")
        for j in joins:
            print(f"  [join] {j.get('name', '?')}: {j.get('left_table')} -> {j.get('right_table')}")
        for e in expressions:
            print(f"  [expr] {e.get('name')}: {e.get('display_name', '')}")
        for q in queries:
            print(f"  [query] {q['title']}")
        return

    # Fetch existing space to get current instruction IDs for idempotent upsert
    path = f"/api/2.0/lakeview/spaces/{space_id}"
    print(f"[sync_genie] Fetching space {space_id}…")
    space = _api("GET", path, token)

    existing_instructions = {i.get("title"): i.get("id") for i in space.get("instructions", [])}
    existing_queries = {q.get("title"): q.get("id") for q in space.get("trusted_assets", {}).get("queries", [])}
    existing_expressions = {e.get("name"): e.get("id") for e in space.get("trusted_assets", {}).get("functions", [])}

    # Build the update payload
    instruction_payloads = [
        {
            **({"id": existing_instructions[i["title"]]} if i["title"] in existing_instructions else {}),
            "title": i["title"],
            "content": i["content"],
        }
        for i in text_instructions
    ]

    join_payloads = [
        {
            "left_table": j["left_table"],
            "right_table": j["right_table"],
            "join_type": j.get("join_type", "LEFT JOIN"),
            "join_columns": [
                {"left_column": on.split("=")[1].split(".")[-1].strip(), "right_column": on.split("=")[0].split(".")[-1].strip()}
                for on in j.get("on", [])
            ],
            "description": j.get("purpose", ""),
        }
        for j in joins
    ]

    query_payloads = [
        {
            **({"id": existing_queries[q["title"]]} if q["title"] in existing_queries else {}),
            "title": q["title"],
            "query": q["sql"],
        }
        for q in queries
    ]

    expression_payloads = [
        {
            **({"id": existing_expressions[e["name"]]} if e["name"] in existing_expressions else {}),
            "name": e["name"],
            "display_name": e.get("display_name", e["name"]),
            "description": e.get("description", ""),
            "sql_expression": e["sql"].strip(),
        }
        for e in expressions
    ]

    payload = {
        "instructions": instruction_payloads,
        "table_instructions": [],          # column-level descriptions can be added here later
        "trusted_assets": {
            "queries": query_payloads,
            "functions": expression_payloads,
        },
    }

    if join_payloads:
        payload["joins"] = join_payloads

    print(f"[sync_genie] Syncing to space {space_id}…")
    _api("PATCH", path, token, payload)
    print("[sync_genie] Done.")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    args = parse_args()
    app_dir = Path(args.app_dir)
    genie_dir = app_dir / "genie"

    if not genie_dir.exists():
        sys.exit(f"[sync_genie] Genie directory not found: {genie_dir}")

    try:
        import yaml  # noqa: F401
    except ImportError:
        sys.exit("[sync_genie] PyYAML is required: pip install pyyaml")

    token = resolve_token(args.profile)
    space_id = resolve_space_id()

    sync(genie_dir, token, space_id, args.dry_run)


if __name__ == "__main__":
    main()
