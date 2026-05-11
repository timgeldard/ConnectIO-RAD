"""Cursor encoding/decoding and batch-sequence assignment for keyset chart pagination.

The cursor is a colon-delimited tuple
``(batch_date_epoch, batch_id, sample_id, inspection_lot_id, operation_id)``
that uniquely orders chart rows so the API can resume paging from any boundary
without an offset scan.  Components are URL-encoded so colon/percent characters
in batch IDs cannot corrupt the cursor.

Extracted from ``charts.py`` (review item M-5).  ``charts.py`` re-exports the
public ``encode_chart_cursor`` and ``decode_chart_cursor`` symbols for backward
compatibility with callers and tests.
"""
from __future__ import annotations

from typing import Optional
from urllib.parse import quote, unquote


def encode_chart_cursor(
    batch_date_epoch: int,
    batch_id: str,
    sample_id: str,
    inspection_lot_id: str,
    operation_id: str,
) -> str:
    """Encode a keyset-pagination cursor for SPC chart data.

    URL-encodes each string component so that colons or percent characters in
    batch/sample identifiers do not corrupt the cursor delimiter.
    """
    return ":".join(
        [
            str(batch_date_epoch),
            quote(batch_id, safe=""),
            quote(sample_id, safe=""),
            quote(inspection_lot_id, safe=""),
            quote(operation_id, safe=""),
        ]
    )


def decode_chart_cursor(cursor: str) -> tuple[int, str, str, str, str]:
    """Decode a chart cursor into its tuple form.

    Raises ``ValueError`` for malformed input (wrong number of components,
    non-integer epoch, empty batch_id) with a message describing the expected
    format.
    """
    try:
        (
            batch_date_epoch_str,
            batch_id_raw,
            sample_id_raw,
            inspection_lot_id_raw,
            operation_id_raw,
        ) = cursor.split(":", 4)
        batch_date_epoch = int(batch_date_epoch_str)
    except (AttributeError, TypeError, ValueError) as exc:
        raise ValueError(
            "cursor must be formatted as "
            "'batch_date(epoch):batch_id:sample_id:inspection_lot_id:operation_id'"
        ) from exc

    batch_id = unquote(batch_id_raw)
    sample_id = unquote(sample_id_raw)
    if not batch_id:
        raise ValueError("cursor batch_id must not be empty")
    return (
        batch_date_epoch,
        batch_id,
        sample_id,
        unquote(inspection_lot_id_raw),
        unquote(operation_id_raw),
    )


def _assign_batch_sequence(rows: list[dict]) -> list[dict]:
    """Stamp each row with a 1-based ``batch_seq`` that increments per distinct batch.

    Operates in place and returns the same list for chaining convenience.
    Caller must ensure rows are already sorted by (batch_date, batch_id).
    """
    batch_seq = 0
    last_batch_key: Optional[tuple[Optional[str], Optional[str]]] = None
    for row in rows:
        batch_key = (row.get("batch_date"), row.get("batch_id"))
        if batch_key != last_batch_key:
            batch_seq += 1
            last_batch_key = batch_key
        row["batch_seq"] = batch_seq
    return rows
