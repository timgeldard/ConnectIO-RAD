"""DAL — POH plant discovery with names from gold.gold_plant."""

from processorderhistory_backend.db import POH_CATALOG, run_sql_async, tbl


async def fetch_plants(token: str) -> list[dict]:
    """Return distinct plants visible in POH gold views, enriched with names.

    Selects distinct ``PLANT_ID`` values from ``vw_gold_process_order`` and
    LEFT JOINs to ``gold.gold_plant`` for human-readable names.

    Args:
        token: Databricks access token forwarded from the proxy.

    Returns:
        List of ``{plant_id, plant_name}`` dicts ordered by ``plant_id``.
    """
    q = f"""
        SELECT
            po.PLANT_ID   AS plant_id,
            COALESCE(gp.PLANT_NAME, po.PLANT_ID) AS plant_name
        FROM (
            SELECT DISTINCT PLANT_ID
            FROM {tbl('vw_gold_process_order')}
            WHERE PLANT_ID IS NOT NULL
        ) po
        LEFT JOIN `{POH_CATALOG}`.`gold`.`gold_plant` gp
            ON gp.PLANT_ID = po.PLANT_ID
        ORDER BY po.PLANT_ID
    """
    return await run_sql_async(token, q, None, endpoint_hint="poh.plants")
