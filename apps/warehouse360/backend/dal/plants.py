"""DAL - warehouse plant discovery."""

from backend.utils.db import run_sql_async, tbl


async def fetch_plants(token: str) -> list[dict]:
    """Return plants visible in Warehouse360 operational views."""
    q = f"""
        SELECT plant_id, MIN(plant_name) AS plant_name
        FROM (
          SELECT plant_id, plant_id AS plant_name FROM {tbl('wh360_process_orders_v')} WHERE plant_id IS NOT NULL
          UNION ALL
          SELECT plant_id, plant_id AS plant_name FROM {tbl('wh360_deliveries_v')} WHERE plant_id IS NOT NULL
          UNION ALL
          SELECT plant_id, plant_id AS plant_name FROM {tbl('wh360_inbound_v')} WHERE plant_id IS NOT NULL
          UNION ALL
          SELECT plant_id, plant_id AS plant_name FROM {tbl('wh360_lineside_stock_v')} WHERE plant_id IS NOT NULL
          UNION ALL
          SELECT plant_id, plant_id AS plant_name FROM {tbl('wh360_dispensary_tasks_v')} WHERE plant_id IS NOT NULL
        ) AS plant_source
        GROUP BY plant_id
        ORDER BY plant_id
    """
    return await run_sql_async(token, q, [], endpoint_hint="wh360.plants")
