# Sample Data

> This directory holds small, static sample datasets for offline agent testing.
> These are NOT live data. They are representative examples.

## Purpose

When agents are working offline (no Databricks access), they can use these
samples to:

1. Validate SQL query logic against known data
2. Build and test frontend components with realistic shapes
3. Verify API response parsing

## Conventions

- Samples use the same column names and types as the real gold-layer views
- Sample values are realistic but anonymised — no real customer names or PII
- Each sample is a small extract (5–20 rows) — enough to test logic, not for analytics
- Files are CSV for tabular data, JSON for nested/API-shaped data

## Available Samples

| File | Source Entity | Rows | Description |
|---|---|---|---|
| _(add samples as needed)_ | | | |

## How to Generate Samples

When you have live Databricks access, generate fresh samples:

```sql
-- Example: export 10 rows from gold_batch_stock_v
SELECT * FROM connected_plant_uat.gold.gold_batch_stock_v
WHERE MATERIAL_ID = '20582002'
LIMIT 10;
```

Save the output as CSV in this directory. Update the table above.

## Freshness

Samples should be refreshed when:
- Gold view schemas change
- New entities are added to entities.yaml
- Sample data becomes misleading (e.g., all stock = 0)

**Last refreshed**: _(update this date when you regenerate)_
