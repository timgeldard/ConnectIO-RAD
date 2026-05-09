"""DAL - warehouse plant discovery."""

from warehouse360_backend.utils.db import TRACE_CATALOG, run_sql_async, tbl


async def fetch_plants(token: str) -> list[dict]:
    """Return plants visible in Warehouse360 operational views, enriched with names from gold.

    Collects distinct plant IDs across all W360 views then LEFT JOINs to
    ``gold.gold_plant`` for human-readable names.  Plants missing from the gold
    dimension fall back to their ID as the display name.
    """
    q = f"""
        SELECT
            ps.plant_id,
            COALESCE(gp.PLANT_NAME, ps.plant_id) AS plant_name
        FROM (
          SELECT DISTINCT plant_id
          FROM (
            SELECT plant_id FROM {tbl('wh360_process_orders_v')} WHERE plant_id IS NOT NULL
            UNION ALL
            SELECT plant_id FROM {tbl('wh360_deliveries_v')} WHERE plant_id IS NOT NULL
            UNION ALL
            SELECT plant_id FROM {tbl('wh360_inbound_v')} WHERE plant_id IS NOT NULL
            UNION ALL
            SELECT plant_id FROM {tbl('wh360_lineside_stock_v')} WHERE plant_id IS NOT NULL
            UNION ALL
            SELECT plant_id FROM {tbl('wh360_dispensary_tasks_v')} WHERE plant_id IS NOT NULL
            UNION ALL
            SELECT plant_id FROM {tbl('wh360_bin_stock_v')} WHERE plant_id IS NOT NULL
            UNION ALL
            SELECT plant_id FROM {tbl('wh360_handling_units_v')} WHERE plant_id IS NOT NULL
          )
        ) ps
        LEFT JOIN `{TRACE_CATALOG}`.`gold`.`gold_plant` gp
            ON gp.PLANT_ID = ps.plant_id
        ORDER BY ps.plant_id
    """
    return await run_sql_async(token, q, [], endpoint_hint="wh360.plants")
