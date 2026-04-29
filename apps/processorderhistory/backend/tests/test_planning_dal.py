"""Unit tests for planning_dal — coerce helpers, KPI builder, fetch."""
import asyncio
from unittest.mock import patch

import pytest

from backend.dal import planning_dal as dal

_NOW_MS = 1_700_000_000_000
_MS_PER_HOUR = 3_600_000
_MS_PER_DAY = 86_400_000


# ---------------------------------------------------------------------------
# _coerce_block
# ---------------------------------------------------------------------------

def test_coerce_block_running():
    row = {
        "process_order_id": "PO001",
        "line_id": "MIX-04",
        "scheduled_start_ms": "1700000000000",
        "order_status": "IN PROGRESS",
        "material_id": "000000000020582002",
        "material_name": "Whey Protein",
    }
    result = dal._coerce_block(row, _NOW_MS)
    assert result is not None
    assert result["kind"] == "running"
    assert result["poId"] == "PO001"
    assert result["lineId"] == "MIX-04"
    assert result["start"] == 1700000000000
    assert result["end"] == 1700000000000 + dal._DEFAULT_BLOCK_HRS * _MS_PER_HOUR
    assert result["label"] == "Whey Protein"
    assert result["sublabel"] == "000000000020582002"


def test_coerce_block_completed():
    row = {
        "process_order_id": "PO002",
        "line_id": "SPD-02",
        "scheduled_start_ms": "1700000000000",
        "order_status": "COMPLETED",
        "material_id": None,
        "material_name": "PO002",
    }
    result = dal._coerce_block(row, _NOW_MS)
    assert result is not None
    assert result["kind"] == "completed"


def test_coerce_block_closed_maps_to_completed():
    row = {
        "process_order_id": "PO003",
        "line_id": "MIX-01",
        "scheduled_start_ms": "1700000000000",
        "order_status": "CLOSED",
        "material_id": None,
        "material_name": None,
    }
    result = dal._coerce_block(row, _NOW_MS)
    assert result is not None
    assert result["kind"] == "completed"


def test_coerce_block_cancelled_returns_none():
    row = {
        "process_order_id": "PO004",
        "line_id": "MIX-04",
        "scheduled_start_ms": "1700000000000",
        "order_status": "CANCELLED",
        "material_id": None,
        "material_name": None,
    }
    assert dal._coerce_block(row, _NOW_MS) is None


def test_coerce_block_unknown_status_maps_to_firm():
    row = {
        "process_order_id": "PO005",
        "line_id": "SPD-01",
        "scheduled_start_ms": "1700000000000",
        "order_status": "NOT STARTED",
        "material_id": "MAT001",
        "material_name": "Some Product",
    }
    result = dal._coerce_block(row, _NOW_MS)
    assert result is not None
    assert result["kind"] == "firm"


def test_coerce_block_null_start_falls_back_to_now():
    row = {
        "process_order_id": "PO006",
        "line_id": "MIX-04",
        "scheduled_start_ms": None,
        "order_status": "IN PROGRESS",
        "material_id": None,
        "material_name": None,
    }
    result = dal._coerce_block(row, _NOW_MS)
    assert result is not None
    assert result["start"] == _NOW_MS


def test_coerce_block_id_is_unique_per_po_and_line():
    row = {
        "process_order_id": "PO007",
        "line_id": "MIX-04",
        "scheduled_start_ms": "1700000000000",
        "order_status": "IN PROGRESS",
        "material_id": None,
        "material_name": None,
    }
    result = dal._coerce_block(row, _NOW_MS)
    assert result["id"] == "PO007-MIX-04"


# ---------------------------------------------------------------------------
# _coerce_backlog
# ---------------------------------------------------------------------------

def test_coerce_backlog_shape():
    row = {
        "process_order_id": "BL001",
        "material_id": "MAT002",
        "material_name": "Some Material",
    }
    result = dal._coerce_backlog(row, _NOW_MS + 7 * _MS_PER_DAY)
    assert result["id"] == "bl-BL001"
    assert result["poId"] == "BL001"
    assert result["product"] == "Some Material"
    assert result["priority"] == "normal"
    assert result["durationH"] == dal._DEFAULT_BLOCK_HRS


def test_coerce_backlog_null_material_uses_po_id():
    row = {
        "process_order_id": "BL002",
        "material_id": None,
        "material_name": None,
    }
    result = dal._coerce_backlog(row, _NOW_MS)
    assert result["product"] == "BL002"


# ---------------------------------------------------------------------------
# _build_kpis
# ---------------------------------------------------------------------------

def _make_block(kind: str, start_ms: int) -> dict:
    return {
        "kind": kind,
        "lineId": "MIX-04",
        "start": start_ms,
        "qty": 1000,
    }


def test_build_kpis_running_count():
    today_ms = (_NOW_MS // _MS_PER_DAY) * _MS_PER_DAY
    blocks = [
        _make_block("running", today_ms),
        _make_block("running", today_ms),
        _make_block("firm", today_ms),
    ]
    kpis = dal._build_kpis(blocks, [], _NOW_MS)
    assert kpis["runningCount"] == 2


def test_build_kpis_total_lines():
    today_ms = (_NOW_MS // _MS_PER_DAY) * _MS_PER_DAY
    blocks = [
        {**_make_block("running", today_ms), "lineId": "MIX-04"},
        {**_make_block("firm", today_ms), "lineId": "SPD-02"},
        {**_make_block("firm", today_ms), "lineId": "MIX-04"},
    ]
    kpis = dal._build_kpis(blocks, [], _NOW_MS)
    assert kpis["totalLines"] == 2


def test_build_kpis_todays_count_excludes_other_days():
    today_ms = (_NOW_MS // _MS_PER_DAY) * _MS_PER_DAY
    yesterday_ms = today_ms - _MS_PER_DAY
    blocks = [
        _make_block("running", today_ms),
        _make_block("firm", yesterday_ms),
    ]
    kpis = dal._build_kpis(blocks, [], _NOW_MS)
    assert kpis["todaysCount"] == 1


def test_build_kpis_backlog_count():
    kpis = dal._build_kpis([], [{"id": "bl-1"}, {"id": "bl-2"}], _NOW_MS)
    assert kpis["backlogCount"] == 2


def test_build_kpis_empty():
    kpis = dal._build_kpis([], [], _NOW_MS)
    assert kpis["runningCount"] == 0
    assert kpis["totalLines"] == 0
    assert kpis["backlogCount"] == 0


# ---------------------------------------------------------------------------
# fetch_planning_schedule — integration (mocked run_sql_async)
# ---------------------------------------------------------------------------

_BLOCK_ROW = {
    "process_order_id": "PO001",
    "line_id": "MIX-04",
    "scheduled_start_ms": "1700000000000",
    "order_status": "IN PROGRESS",
    "material_id": "MAT001",
    "material_name": "Test Product",
}

_BACKLOG_ROW = {
    "process_order_id": "BL001",
    "material_id": "MAT002",
    "material_name": "Backlog Product",
}


def _make_sql_mock(call_results: list[list[dict]]):
    call_iter = iter(call_results)

    async def fake_run_sql_async(_token, _query, _params=None, **_kwargs):
        return next(call_iter)

    return fake_run_sql_async


def test_fetch_planning_schedule_returns_full_shape(monkeypatch):
    monkeypatch.setattr(dal, "run_sql_async", _make_sql_mock([
        [_BLOCK_ROW],   # blocks
        [_BACKLOG_ROW], # backlog
    ]))
    result = asyncio.run(dal.fetch_planning_schedule("token"))
    assert "now_ms" in result
    assert "today_ms" in result
    assert "window_start_ms" in result
    assert "window_end_ms" in result
    assert result["lines"] == ["MIX-04"]
    assert len(result["blocks"]) == 1
    assert result["blocks"][0]["kind"] == "running"
    assert result["blocks"][0]["label"] == "Test Product"
    assert len(result["backlog"]) == 1
    assert result["backlog"][0]["poId"] == "BL001"
    assert "kpis" in result


def test_fetch_planning_schedule_excludes_cancelled(monkeypatch):
    cancelled_row = {**_BLOCK_ROW, "order_status": "CANCELLED"}
    monkeypatch.setattr(dal, "run_sql_async", _make_sql_mock([
        [cancelled_row],
        [],
    ]))
    result = asyncio.run(dal.fetch_planning_schedule("token"))
    assert result["blocks"] == []
    assert result["lines"] == []


def test_fetch_planning_schedule_empty_data(monkeypatch):
    monkeypatch.setattr(dal, "run_sql_async", _make_sql_mock([[], []]))
    result = asyncio.run(dal.fetch_planning_schedule("token"))
    assert result["blocks"] == []
    assert result["backlog"] == []
    assert result["lines"] == []
    assert result["kpis"]["runningCount"] == 0


def test_fetch_planning_schedule_window_bounds(monkeypatch):
    monkeypatch.setattr(dal, "run_sql_async", _make_sql_mock([[], []]))
    result = asyncio.run(dal.fetch_planning_schedule("token"))
    assert result["window_start_ms"] < result["now_ms"]
    assert result["window_end_ms"] > result["now_ms"]
    assert result["today_ms"] <= result["now_ms"]
