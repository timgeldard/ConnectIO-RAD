"""DAL for equipment insights — instrument master distribution from vw_gold_instrument.

Runs one Databricks query:
  1. type_distribution — COUNT(*) GROUP BY EQUIPMENT_SUB_TYPE from vw_gold_instrument

Type grouping is derived in Python via _SUBTYPE_TO_TYPE because EQUIPMENT_TYPE exists
in the bronze source but has not yet been promoted to vw_gold_instrument.

TODO: Once EQUIPMENT_TYPE is added to vw_gold_instrument (promote from bronze),
  replace the _aggregate_by_type step with a direct GROUP BY EQUIPMENT_TYPE in the SQL
  and remove _SUBTYPE_TO_TYPE.

Scale verification (connected_plant_prod.tulip.scale_verification_results) is intentionally
NOT queried here.  That table requires a Unity Catalogue consumption view before it can be
accessed safely.  See the TODO in EquipmentInsights.tsx for the frontend placeholder.
"""
from collections import defaultdict
from typing import Optional

from backend.db import instrument_tbl, run_sql_async, sql_param

# ---------------------------------------------------------------------------
# Subtype → type mapping
# TODO: Remove once EQUIPMENT_TYPE is promoted from bronze to vw_gold_instrument.
#
# Note: Pallet and Processing Unit both have NULL EQUIPMENT_SUB_TYPE in the
# current gold view. They cannot be distinguished by subtype alone and will
# appear as "Uncategorised" until the type column is available.
# ---------------------------------------------------------------------------

_SUBTYPE_TO_TYPE: dict[str, str] = {
    "Bucket":          "Auxiliary Equipment",
    "Buckets":         "Auxiliary Equipment",  # legacy spelling variant
    "CCP Screen":      "Auxiliary Equipment",
    "Other":           "Auxiliary Equipment",
    "Pump":            "Auxiliary Equipment",
    "Connected Scale": "Scale",
    "Manual Scale":    "Scale",
    "Fixed":           "Vessel",
    "Mobile":          "Vessel",
    "Mobile-FixBin":   "Vessel",
    "ZIBC":            "Vessel",
}

_UNCATEGORISED = "Uncategorised"


# ---------------------------------------------------------------------------
# Query coroutines
# ---------------------------------------------------------------------------


async def _q_type_distribution(token: str, plant_id: Optional[str]) -> list[dict]:
    """COUNT of instruments grouped by EQUIPMENT_SUB_TYPE.

    Plant filtering is optional — omitting plant_id returns all plants.
    """
    plant_clause = "AND PLANT_ID = :plant_id" if plant_id else ""
    params: Optional[list[dict]] = [sql_param("plant_id", plant_id)] if plant_id else None

    query = f"""
        SELECT
            EQUIPMENT_SUB_TYPE AS equipment_sub_type,
            COUNT(*)           AS instrument_count
        FROM {instrument_tbl('vw_gold_instrument')}
        WHERE 1=1
          {plant_clause}
        GROUP BY EQUIPMENT_SUB_TYPE
        ORDER BY instrument_count DESC
    """
    return await run_sql_async(
        token, query, params, endpoint_hint="poh.equipment_insights.type_dist"
    )


# ---------------------------------------------------------------------------
# Derivation logic (pure Python — testable without mocking)
# ---------------------------------------------------------------------------


def _aggregate_by_type(sub_type_rows: list[dict]) -> list[dict]:
    """Aggregate instrument counts from EQUIPMENT_SUB_TYPE up to EQUIPMENT_TYPE.

    Uses _SUBTYPE_TO_TYPE for known mappings. Unknown or null subtypes are
    grouped under 'Uncategorised'.

    Returns a list of {equipment_type, instrument_count} dicts sorted descending
    by count, ready for _derive_equipment_insights.
    """
    totals: dict[str, int] = defaultdict(int)
    for row in sub_type_rows:
        sub_type = row.get("equipment_sub_type")
        count = int(row.get("instrument_count") or 0)
        equipment_type = _SUBTYPE_TO_TYPE.get(sub_type, _UNCATEGORISED) if sub_type else _UNCATEGORISED
        totals[equipment_type] += count
    return [
        {"equipment_type": et, "instrument_count": c}
        for et, c in sorted(totals.items(), key=lambda kv: -kv[1])
    ]


def _derive_equipment_insights(type_rows: list[dict]) -> dict:
    """Build the equipment insights response from type-aggregated rows.

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
      - ``total_instrument_count`` — total instruments in the master
      - ``type_distribution``      — counts and percentages by derived EQUIPMENT_TYPE
    """
    sub_type_rows = await _q_type_distribution(token, plant_id)
    type_rows = _aggregate_by_type(sub_type_rows)
    return _derive_equipment_insights(type_rows)
