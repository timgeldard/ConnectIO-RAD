"""Run the recall-readiness queries directly and print one row per block."""
import json
import os
import subprocess
import sys
from pathlib import Path

WAREHOUSE_ID = os.environ.get("WAREHOUSE_ID", "e76480b94bea6ed5")
PROFILE = os.environ.get("DATABRICKS_CONFIG_PROFILE", "uat")
CATALOG = os.environ.get("TRACE_CATALOG", "connected_plant_uat")
SCHEMA = os.environ.get("TRACE_SCHEMA", "gold")

sys.path.insert(0, str(Path(__file__).parent.parent))
# Reuse the DAL query text by importing the module after patching run_sql_async.
# Simpler: duplicate the relevant queries here so the probe stands alone.

MAT = os.environ.get("MAT", "20582002")
BAT = os.environ.get("BAT", "0008898869")


def run(stmt: str) -> list[dict]:
    body = json.dumps({
        "warehouse_id": WAREHOUSE_ID,
        "statement": stmt,
        "wait_timeout": "50s",
        "parameters": [
            {"name": "mat", "value": MAT, "type": "STRING"},
            {"name": "bat", "value": BAT, "type": "STRING"},
        ],
    })
    result = subprocess.run(
        ["databricks", "api", "post", "/api/2.0/sql/statements/", "--profile", PROFILE, "--json", body],
        capture_output=True, text=True, check=False,
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
    return [dict(zip(cols, row)) for row in payload.get("result", {}).get("data_array", []) or []]


def tbl(name: str) -> str:
    return f"`{CATALOG}`.`{SCHEMA}`.`{name}`"


if __name__ == "__main__":
    import backend.dal.trace_dal  # noqa: F401 ensure syntax ok
    from backend.dal.trace_dal import fetch_recall_readiness  # noqa
    # We can't easily call the async DAL here without the FastAPI plumbing, so
    # instead just pull the query strings from the DAL module by hand below.
    # Quick smoke-tests of each block:
    print("=== HEADER ===")
    rows = run(f"""
        WITH prod AS (
          SELECT * FROM {tbl('gold_batch_mass_balance_v')}
          WHERE MATERIAL_ID = :mat AND BATCH_ID = :bat AND MOVEMENT_CATEGORY = 'Production'
        ),
        prod_agg AS (
          SELECT MAX_BY(PROCESS_ORDER_ID, POSTING_DATE) AS process_order,
                 MAX_BY(PLANT_ID, POSTING_DATE) AS prod_plant_id,
                 CAST(MIN(POSTING_DATE) AS STRING) AS manufacture_date,
                 COALESCE(MAX(UOM), 'KG') AS uom,
                 COALESCE(SUM(ABS_QUANTITY), 0) AS qty_produced
          FROM prod
        ),
        mb_totals AS (
          SELECT
            COALESCE(SUM(CASE WHEN MOVEMENT_CATEGORY = 'Shipment' THEN ABS_QUANTITY ELSE 0 END), 0) AS qty_shipped,
            COALESCE(SUM(CASE WHEN MOVEMENT_TYPE IN ('261','262','201','202') THEN ABS_QUANTITY ELSE 0 END), 0) AS qty_consumed,
            COALESCE(SUM(CASE WHEN MOVEMENT_TYPE IN ('701','702','711','712','531','532') THEN ABS_QUANTITY ELSE 0 END), 0) AS qty_adjusted
          FROM {tbl('gold_batch_mass_balance_v')}
          WHERE MATERIAL_ID = :mat AND BATCH_ID = :bat
            AND COALESCE(MOVEMENT_CATEGORY, '') NOT LIKE 'STO%'
        ),
        stk AS (
          SELECT
            COALESCE(SUM(UNRESTRICTED), 0) AS unrestricted,
            COALESCE(SUM(BLOCKED), 0) AS blocked,
            COALESCE(SUM(QUALITY_INSPECTION), 0) AS qi,
            COALESCE(SUM(RESTRICTED), 0) AS restricted,
            COALESCE(SUM(TRANSIT), 0) AS transit,
            COALESCE(SUM(TOTAL_STOCK), 0) AS current_stock,
            MAX(PLANT_ID) AS stk_plant_id
          FROM {tbl('gold_batch_stock_v')}
          WHERE MATERIAL_ID = :mat AND BATCH_ID = :bat
        ),
        del_unique AS (
          SELECT DISTINCT DELIVERY, CUSTOMER_ID, COUNTRY_ID, ABS_QUANTITY
          FROM {tbl('gold_batch_delivery_v')}
          WHERE MATERIAL_ID = :mat AND BATCH_ID = :bat AND DELIVERY IS NOT NULL
        ),
        del AS (
          SELECT
            COUNT(DISTINCT CUSTOMER_ID) AS customers_affected,
            COUNT(DISTINCT COUNTRY_ID) AS countries_affected,
            COALESCE(SUM(ABS_QUANTITY), 0) AS total_shipped_kg,
            COUNT(DISTINCT DELIVERY) AS total_deliveries
          FROM del_unique
        ),
        consuming AS (
          SELECT COUNT(DISTINCT PROCESS_ORDER_ID) AS consuming_pos
          FROM {tbl('gold_batch_lineage')}
          WHERE PARENT_MATERIAL_ID = :mat AND PARENT_BATCH_ID = :bat
            AND LINK_TYPE = 'PRODUCTION' AND PROCESS_ORDER_ID IS NOT NULL
        )
        SELECT
          :mat AS material_id, :bat AS batch_id,
          COALESCE(m.MATERIAL_NAME, :mat) AS material_name,
          COALESCE(SUBSTR(m.MATERIAL_NAME, 1, 40), :mat) AS material_desc40,
          COALESCE(pa.process_order, '') AS process_order,
          COALESCE(pa.prod_plant_id, stk.stk_plant_id, '') AS plant_id,
          COALESCE(p.PLANT_NAME, COALESCE(pa.prod_plant_id, stk.stk_plant_id, '')) AS plant_name,
          pa.manufacture_date,
          pa.uom, pa.qty_produced,
          mb_totals.qty_shipped, mb_totals.qty_consumed, mb_totals.qty_adjusted,
          stk.current_stock, stk.unrestricted, stk.blocked, stk.qi, stk.restricted, stk.transit,
          del.customers_affected, del.countries_affected, del.total_shipped_kg, del.total_deliveries,
          consuming.consuming_pos,
          CASE
            WHEN stk.blocked > 0 THEN 'BLOCKED'
            WHEN stk.qi > 0 THEN 'QUALITY_INSPECTION'
            WHEN stk.restricted > 0 THEN 'RESTRICTED'
            ELSE 'UNRESTRICTED'
          END AS batch_status
        FROM prod_agg pa
        CROSS JOIN mb_totals CROSS JOIN stk CROSS JOIN del CROSS JOIN consuming
        LEFT JOIN {tbl('gold_material')} m ON m.MATERIAL_ID = :mat AND m.LANGUAGE_ID = 'E'
        LEFT JOIN {tbl('gold_plant')} p ON p.PLANT_ID = COALESCE(pa.prod_plant_id, stk.stk_plant_id)
    """)
    print(json.dumps(rows, indent=2, default=str))
