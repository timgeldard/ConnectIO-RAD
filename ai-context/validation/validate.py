#!/usr/bin/env python3
"""
Semantic Model Validator

Validates entities.yaml against a live Databricks SQL warehouse.
Run this when on-network to detect schema drift.

Usage:
    python validate.py --catalog connected_plant_uat --schema gold
    python validate.py --catalog connected_plant_uat --schema gold --token $DATABRICKS_TOKEN
    python validate.py --dry-run  # just parse entities.yaml, no live validation

Requirements:
    pip install pyyaml databricks-sql-connector
"""

import argparse
import os
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    print("ERROR: pyyaml not installed. Run: pip install pyyaml")
    sys.exit(1)


def load_entities(path: Path) -> dict:
    """Load and parse entities.yaml."""
    with open(path) as f:
        return yaml.safe_load(f)


def validate_offline(entities: dict) -> list[str]:
    """Offline validation — checks internal consistency of entities.yaml."""
    issues = []

    if "entities" not in entities:
        issues.append("CRITICAL: No 'entities' key found in entities.yaml")
        return issues

    entity_names = set()
    for entity in entities["entities"]:
        name = entity.get("name", "(unnamed)")

        # Check required fields
        for field in ["name", "type", "tier", "description", "grain", "keys"]:
            if field not in entity:
                issues.append(f"WARNING: {name} missing required field: {field}")

        # Check for duplicate names
        if name in entity_names:
            issues.append(f"ERROR: Duplicate entity name: {name}")
        entity_names.add(name)

        # Check columns have names and types
        for col in entity.get("columns", []):
            if "name" not in col:
                issues.append(f"ERROR: {name} has a column without a name")
            if "type" not in col:
                issues.append(f"WARNING: {name}.{col.get('name', '?')} missing type")

        # Check traps exist
        if not entity.get("traps"):
            issues.append(f"INFO: {name} has no traps documented — consider adding")

    return issues


def validate_online(entities: dict, catalog: str, schema: str, token: str, host: str) -> list[str]:
    """Online validation — compare entities.yaml against live DESCRIBE TABLE."""
    try:
        from databricks import sql as dbsql
    except ImportError:
        return ["ERROR: databricks-sql-connector not installed. Run: pip install databricks-sql-connector"]

    warehouse_path = os.environ.get("DATABRICKS_WAREHOUSE_HTTP_PATH", "")
    if not warehouse_path:
        return ["ERROR: DATABRICKS_WAREHOUSE_HTTP_PATH not set"]

    issues = []

    try:
        connection = dbsql.connect(
            server_hostname=host,
            http_path=warehouse_path,
            access_token=token,
        )
    except Exception as e:
        return [f"ERROR: Could not connect to warehouse: {e}"]

    cursor = connection.cursor()

    for entity in entities.get("entities", []):
        name = entity["name"]
        fqn = f"`{catalog}`.`{schema}`.`{name}`"
        declared_cols = {col["name"] for col in entity.get("columns", [])}

        try:
            cursor.execute(f"DESCRIBE TABLE {fqn}")
            rows = cursor.fetchall()
            live_cols = {row[0] for row in rows if not row[0].startswith("#")}

            # Find mismatches
            missing_in_live = declared_cols - live_cols
            extra_in_live = live_cols - declared_cols

            if missing_in_live:
                issues.append(
                    f"ERROR: {name} — columns in entities.yaml but NOT in live table: "
                    f"{sorted(missing_in_live)}"
                )
            if extra_in_live:
                issues.append(
                    f"INFO: {name} — columns in live table but NOT in entities.yaml: "
                    f"{sorted(extra_in_live)}"
                )
            if not missing_in_live and not extra_in_live:
                issues.append(f"OK: {name} — all {len(declared_cols)} columns match")

        except Exception as e:
            msg = str(e)
            if "TABLE_OR_VIEW_NOT_FOUND" in msg or "does not exist" in msg:
                issues.append(f"ERROR: {name} — table/view does not exist in {catalog}.{schema}")
            else:
                issues.append(f"ERROR: {name} — DESCRIBE failed: {msg[:200]}")

    cursor.close()
    connection.close()
    return issues


def main():
    parser = argparse.ArgumentParser(description="Validate entities.yaml against live Databricks schema")
    parser.add_argument("--catalog", default="connected_plant_uat", help="Unity Catalog name")
    parser.add_argument("--schema", default="gold", help="Schema name")
    parser.add_argument("--token", default=os.environ.get("DATABRICKS_TOKEN", ""), help="Access token")
    parser.add_argument("--host", default=os.environ.get("DATABRICKS_HOST", ""), help="Workspace host")
    parser.add_argument("--dry-run", action="store_true", help="Offline validation only")
    parser.add_argument("--entities", default=None, help="Path to entities.yaml")
    args = parser.parse_args()

    # Find entities.yaml
    if args.entities:
        entities_path = Path(args.entities)
    else:
        # Look relative to this script
        entities_path = Path(__file__).parent.parent / "semantic-model" / "entities.yaml"

    if not entities_path.exists():
        print(f"ERROR: entities.yaml not found at {entities_path}")
        sys.exit(1)

    print(f"Loading: {entities_path}")
    entities = load_entities(entities_path)
    entity_count = len(entities.get("entities", []))
    print(f"Found {entity_count} entities\n")

    # Offline validation
    print("=" * 60)
    print("OFFLINE VALIDATION (internal consistency)")
    print("=" * 60)
    offline_issues = validate_offline(entities)
    for issue in offline_issues:
        print(f"  {issue}")
    if not offline_issues:
        print("  All checks passed.")

    # Online validation
    if not args.dry_run:
        print()
        print("=" * 60)
        print(f"ONLINE VALIDATION (vs {args.catalog}.{args.schema})")
        print("=" * 60)
        if not args.token:
            print("  SKIPPED: No token provided. Use --token or set DATABRICKS_TOKEN.")
        elif not args.host:
            print("  SKIPPED: No host provided. Use --host or set DATABRICKS_HOST.")
        else:
            online_issues = validate_online(entities, args.catalog, args.schema, args.token, args.host)
            for issue in online_issues:
                print(f"  {issue}")

    # Summary
    print()
    error_count = sum(1 for i in offline_issues if i.startswith("ERROR"))
    warning_count = sum(1 for i in offline_issues if i.startswith("WARNING"))
    print(f"Summary: {error_count} errors, {warning_count} warnings, {entity_count} entities checked")

    sys.exit(1 if error_count > 0 else 0)


if __name__ == "__main__":
    main()
