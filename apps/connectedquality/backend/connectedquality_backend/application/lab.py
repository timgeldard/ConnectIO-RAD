"""Lab Board application service backed by inspection-result gold views."""
from typing import Optional

from connectedquality_backend.dal.lab import fetch_lab_failure_rows


def _coerce_fail(row: dict) -> dict:
    """Normalize a warehouse row into the Lab Board failure contract.

    Args:
        row: Raw row returned by the Lab Board DAL query.

    Returns:
        Dictionary with material, lot, batch, line, characteristic, result,
        limits, unit, and severity fields expected by the frontend.
    """
    result = row.get("quantitative_result")
    lo = row.get("lower_limit")
    hi = row.get("upper_limit")
    valuation = str(row.get("judgement") or "R")
    return {
        "mat": str(row.get("material_name") or row.get("material_id") or "—"),
        "matNo": str(row.get("material_id") or "—"),
        "lot": str(row.get("inspection_lot_id") or "—"),
        "batch": str(row.get("batch_id") or row.get("process_order") or "—"),
        "line": str(row.get("process_line") or "—"),
        "char": str(row.get("characteristic_id") or "—"),
        "text": str(row.get("characteristic_description") or row.get("characteristic_id") or "—"),
        "res": float(result) if result is not None else 0.0,
        "lo": float(lo) if lo is not None else 0.0,
        "hi": float(hi) if hi is not None else 0.0,
        "units": str(row.get("uom") or ""),
        "sev": "warn" if valuation == "W" else "fail",
    }


async def fetch_lab_failures(token: str, *, plant_id: str, lot_type: Optional[str] = None) -> dict:
    """Return failed or warning inspection characteristics for the Lab Board.

    Args:
        token: Databricks access token forwarded from the request.
        plant_id: Plant identifier selected by the user or platform session.
        lot_type: Optional SAP inspection lot type filter.

    Returns:
        Dictionary containing the selected plant, optional lot type, normalized
        failure rows, and a ``data_available`` flag.
    """
    rows = await fetch_lab_failure_rows(token, plant_id=plant_id, lot_type=lot_type)
    return {
        "plant_id": plant_id,
        "lot_type": lot_type,
        "fails": [_coerce_fail(row) for row in rows],
        "data_available": True,
    }
