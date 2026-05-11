"""Row-coercion helpers for SPC chart DAL output.

Databricks SQL string-serialises numeric values; these helpers convert raw row
dicts into typed Python values, deriving USL/LSL from nominal+tolerance when the
view does not supply them directly, and stripping cursor-only fields before the
row reaches the application layer.

Extracted from ``charts.py`` for separation of concerns (see review item M-5).
``charts.py`` re-exports ``_apply_chart_row_formatting`` for backward
compatibility with tests that import it as ``spc_charts_dal._apply_chart_row_formatting``.
"""
from __future__ import annotations

import math

from spc_backend.process_control.domain.capability import infer_spec_type


def _format_chart_row_error(field_name: str, raw_value: object, row: dict) -> str:
    """Build a diagnostic message identifying which chart row field failed coercion."""
    batch_id = row.get("batch_id")
    sample_id = (
        row.get("SAMPLE_ID")
        if row.get("SAMPLE_ID") is not None
        else (
            row.get("cursor_sample_id")
            if row.get("cursor_sample_id") is not None
            else row.get("sample_seq")
        )
    )
    return (
        f"Invalid chart row value for field '{field_name}' in batch_id={batch_id!r}, "
        f"sample_id={sample_id!r}: {raw_value!r}; row={row!r}"
    )


def _coerce_chart_float(row: dict, field_name: str) -> None:
    """Coerce ``row[field_name]`` to a finite float in place; replace NaN/Inf with None."""
    value = row.get(field_name)
    if value is None:
        return
    try:
        f = float(value)
        if math.isnan(f) or math.isinf(f):
            row[field_name] = None
            return
        row[field_name] = f
    except (ValueError, TypeError) as exc:
        raise ValueError(_format_chart_row_error(field_name, value, row)) from exc


def _coerce_chart_int(row: dict, field_name: str) -> None:
    """Coerce ``row[field_name]`` to an int in place (via float to accept '1.0')."""
    value = row.get(field_name)
    if value is None:
        return
    try:
        row[field_name] = int(float(value))
    except (ValueError, TypeError) as exc:
        raise ValueError(_format_chart_row_error(field_name, value, row)) from exc


def _apply_chart_row_formatting(rows: list[dict]) -> list[dict]:
    """Coerce types and derive USL/LSL on each chart row in place; return the same list.

    For each row:
    - ``value``, ``nominal``, ``tolerance``, ``lsl``, ``usl`` → finite float or None.
    - ``sample_seq`` → int or None.
    - ``is_outlier`` derived from the legacy ``attribut == '*'`` flag.
    - When USL/LSL are absent, derive **only the missing side** from
      ``nominal ± tolerance`` (a supplied one-sided spec is preserved).
    - Each present bound is rounded to 6 dp.
    - ``spec_type`` derived from the resolved USL/LSL/nominal triplet.
    - Drop cursor-only fields so they do not leak to the application layer.

    Args:
        rows: Raw chart rows from the SPC quality-data query.  Mutated in place.

    Returns:
        The same list, with each row's typed/derived fields filled.
    """
    for row in rows:
        for field_name in ["value", "nominal", "tolerance", "lsl", "usl"]:
            _coerce_chart_float(row, field_name)
        _coerce_chart_int(row, "sample_seq")
        row["is_outlier"] = row.get("attribut") == "*"
        usl = row.get("usl")
        lsl = row.get("lsl")
        if usl is None or lsl is None:
            nominal = row.get("nominal")
            tol = row.get("tolerance")
            if nominal is not None and tol is not None:
                # Only derive the missing side; preserve a supplied one-sided spec.
                if usl is None:
                    usl = nominal + tol
                if lsl is None:
                    lsl = nominal - tol
        row["usl"] = round(usl, 6) if usl is not None else None
        row["lsl"] = round(lsl, 6) if lsl is not None else None
        row["spec_type"] = infer_spec_type(row["usl"], row["lsl"], row.get("nominal"))
        if "plant_id" not in row:
            row["plant_id"] = None
        row.pop("cursor_batch_date_epoch", None)
        row.pop("cursor_sample_id", None)
        row.pop("cursor_inspection_lot_id", None)
        row.pop("cursor_operation_id", None)
    return rows
