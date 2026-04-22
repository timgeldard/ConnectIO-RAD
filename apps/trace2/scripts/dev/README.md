# scripts/dev

Local SQL probe helpers. Not wired into the app; useful for validating queries
or inspecting gold views from the command line.

Prerequisites:
- `databricks` CLI authenticated with the `uat` profile (or pass another)
- Python 3.10+

## run_sql.py

One-shot SQL, no parameters.

```bash
DATABRICKS_CONFIG_PROFILE=uat python scripts/dev/run_sql.py \
  "SELECT COUNT(*) FROM connected_plant_uat.gold.gold_batch_summary_v"
```

## run_sql_named.py

One-shot SQL with named parameters (matches the `:name` syntax the backend
uses via `sql_param()`).

```bash
DATABRICKS_CONFIG_PROFILE=uat python scripts/dev/run_sql_named.py \
  "SELECT * FROM connected_plant_uat.gold.gold_batch_summary_v WHERE MATERIAL_ID = :mat" \
  '{"mat":"20582002"}'
```

## probe_schema.py

Dumps column names + types for the core gold views the backend depends on.

```bash
DATABRICKS_CONFIG_PROFILE=uat python scripts/dev/probe_schema.py
```

## probe_recall.py

Runs the recall-readiness header query inline so you can verify it returns
sensible rows before deploying DAL changes.

```bash
DATABRICKS_CONFIG_PROFILE=uat MAT=20582002 BAT=0008898869 \
  python scripts/dev/probe_recall.py
```

Overrides: `TRACE_CATALOG`, `TRACE_SCHEMA`, `WAREHOUSE_ID`.
