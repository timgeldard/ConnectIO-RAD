"""DAL for equipment insights — instrument master distribution from vw_gold_instrument.

Runs one Databricks query:
  1. type_distribution — COUNT(*) GROUP BY EQUIPMENT_TYPE from vw_gold_instrument

Derivation is pure Python so the page renders even if the database returns zero rows.

Scale verification (connected_plant_prod.tulip.scale_verification_results) is intentionally
NOT queried here.  That table requires a Unity Catalogue consumption view before it can be
accessed safely.  See the TODO in EquipmentInsights.tsx for the frontend placeholder.
"""
import asyncio
from typing import Optional

from backend.db import instrument_tbl, run_sql_async, sql_param

# ---------------------------------------------------------------------------
# Query coroutines
# ---------------------------------------------------------------------------


async def _q_type_distribution(token: str, plant_id: Optional[str]) -> list[dict]:
    """COUNT of instruments grouped by EQUIPMENT_TYPE.

    Excludes Single-Use Vessel rows (consistent with vw_gold_equipment_history usage).
    Plant filtering is optional — omitting plant_id returns all plants.
    """
    plant_clause = "AND PLANT_ID = :plant_id" if plant_id else ""
    params: Optional[list[dict]] = [sql_param("plant_id", plant_id)] if plant_id else None

    query = f"""
        SELECT
            COALESCE(EQUIPMENT_TYPE, 'Unknown') AS equipment_type,
            COUNT(*)                            AS instrument_count
        FROM {instrument_tbl('vw_gold_instrument')}
        WHERE EQUIPMENT_TYPE != 'Single-Use Vessel'
          {plant_clause}
        GROUP BY COALESCE(EQUIPMENT_TYPE, 'Unknown')
        ORDER BY instrument_count DESC
    """
    return await run_sql_async(
        token, query, params, endpoint_hint="poh.equipment_insights.type_dist"
    )


# ---------------------------------------------------------------------------
# Derivation logic (pure Python — testable without mocking)
# ---------------------------------------------------------------------------


def _derive_equipment_insights(type_rows: list[dict]) -> dict:
    """Build the equipment insights response from raw type-distribution rows.

    Returns a dict containing:
      - ``total_instrument_count``  — sum of all instrument counts
      - ``type_distribution``       — list of {equipment_type, count, pct} dicts, sorted descending
    """
    total = sum(int(r.get("instrument_count") or 0) for r in type_rows)
    type_distribution = [
        {
            "equipment_type": str(r.get("equipment_type") or "Unknown"),
            "count": int(r.get("instrument_count") or 0),
            "pct": round(int(r.get("instrument_count") or 0) / total * 100, 1) if total else 0.0,
        }
        for r in type_rows
    ]
    return {
        "total_instrument_count": total,
        "type_distribution": type_distribution,
    }


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


async def fetch_equipment_insights(
    token: str,
    *,
    plant_id: Optional[str] = None,
) -> dict:
    """Fetch equipment master distribution for the equipment insights page.

    Returns:
      - ``total_instrument_count`` — total instruments in the master (excluding single-use)
      - ``type_distribution``      — counts and percentages by EQUIPMENT_TYPE
    """
    type_rows = await _q_type_distribution(token, plant_id)
    return _derive_equipment_insights(type_rows)
