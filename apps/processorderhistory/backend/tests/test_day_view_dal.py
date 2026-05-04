"""Unit tests for day_view_dal — coerce helpers, KPI builder, fetch."""
import asyncio
from datetime import timezone, datetime

import pytest

from backend.order_execution.dal import day_view_dal as dal

_MS_PER_DAY = 86_400_000
_MS_PER_SEC = 1_000

# A fixed UTC day boundary for test data
_DAY_START = int(datetime(2026, 4, 29, tzinfo=timezone.utc).timestamp() * 1000)
_DAY_END = _DAY_START + _MS_PER_DAY - 1


# ---------------------------------------------------------------------------
# _parse_day
# ---------------------------------------------------------------------------

def test_parse_day_returns_given_string():
    assert dal._parse_day("2026-04-29") == "2026-04-29"


def test_parse_day_defaults_to_today():
    result = dal._parse_day(None)
    # Must be a valid ISO date string
    from datetime import date
    date.fromisoformat(result)  # raises ValueError if invalid


# ---------------------------------------------------------------------------
# _coerce_block
# ---------------------------------------------------------------------------

def _block_row(**overrides):
    base = {
        "process_order_id": "PO001",
        "line_id": "LINE-01",
        "order_status": "COMPLETED",
        "planned_qty": "1000.0",
        "confirmed_qty": "980.5",
        "material_id": "MAT-001",
        "material_name": "Whey Protein",
        "first_ms": str(_DAY_START + 2 * 3_600_000),
        "last_ms": str(_DAY_START + 6 * 3_600_000),
    }
    base.update(overrides)
    return base


def test_coerce_block_happy_path():
    row = _block_row()
    b = dal._coerce_block(row, _DAY_START, _DAY_END)
    assert b["id"] == "PO001-LINE-01"
    assert b["poId"] == "PO001"
    assert b["lineId"] == "LINE-01"
    assert b["kind"] == "completed"
    assert b["label"] == "Whey Protein"
    assert b["sublabel"] == "MAT-001"
    assert b["confirmedQty"] == 980.5
    assert b["plannedQty"] == 1000.0
    assert b["uom"] == "KG"
    assert b["start"] == _DAY_START + 2 * 3_600_000
    assert b["end"] == _DAY_START + 6 * 3_600_000


def test_coerce_block_status_running():
    b = dal._coerce_block(_block_row(order_status="IN PROGRESS"), _DAY_START, _DAY_END)
    assert b["kind"] == "running"


def test_coerce_block_status_tulip_running():
    b = dal._coerce_block(_block_row(order_status="Tulip Load In Progress"), _DAY_START, _DAY_END)
    assert b["kind"] == "running"


def test_coerce_block_status_closed():
    b = dal._coerce_block(_block_row(order_status="CLOSED"), _DAY_START, _DAY_END)
    assert b["kind"] == "completed"


def test_coerce_block_unknown_status_maps_to_onhold():
    b = dal._coerce_block(_block_row(order_status="SOMETHING_ELSE"), _DAY_START, _DAY_END)
    assert b["kind"] == "onhold"


def test_coerce_block_clamps_start_to_day_boundary():
    # start before day boundary
    b = dal._coerce_block(_block_row(first_ms=str(_DAY_START - 5_000)), _DAY_START, _DAY_END)
    assert b["start"] == _DAY_START


def test_coerce_block_clamps_end_to_day_boundary():
    b = dal._coerce_block(_block_row(last_ms=str(_DAY_END + 5_000)), _DAY_START, _DAY_END)
    assert b["end"] == _DAY_END


def test_coerce_block_min_duration_when_equal():
    ts = _DAY_START + 3_600_000
    b = dal._coerce_block(_block_row(first_ms=str(ts), last_ms=str(ts)), _DAY_START, _DAY_END)
    assert b["end"] > b["start"]


def test_coerce_block_null_qty_defaults_to_zero():
    b = dal._coerce_block(_block_row(planned_qty=None, confirmed_qty=None), _DAY_START, _DAY_END)
    assert b["plannedQty"] == 0.0
    assert b["confirmedQty"] == 0.0


def test_coerce_block_falls_back_to_po_id_when_no_material_name():
    b = dal._coerce_block(_block_row(material_name=None), _DAY_START, _DAY_END)
    assert b["label"] == "PO001"


# ---------------------------------------------------------------------------
# _coerce_downtime
# ---------------------------------------------------------------------------

def _dt_row(**overrides):
    base = {
        "process_order_id": "PO001",
        "line_id": "LINE-01",
        "start_ms": str(_DAY_START + 4 * 3_600_000),
        "duration_s": "1800",
        "reason_code": "RC01",
        "issue_type": "breakdown",
        "issue_title": "Pump fault",
    }
    base.update(overrides)
    return base


def test_coerce_downtime_happy_path():
    d = dal._coerce_downtime(_dt_row(), _DAY_START, _DAY_END)
    assert d["poId"] == "PO001"
    assert d["lineId"] == "LINE-01"
    assert d["start"] == _DAY_START + 4 * 3_600_000
    assert d["end"] == _DAY_START + 4 * 3_600_000 + 1_800_000
    assert d["reasonCode"] == "RC01"
    assert d["issueType"] == "breakdown"
    assert d["issueTitle"] == "Pump fault"


def test_coerce_downtime_clamps_end_to_day_boundary():
    d = dal._coerce_downtime(_dt_row(start_ms=str(_DAY_END - 500), duration_s="3600"), _DAY_START, _DAY_END)
    assert d["end"] == _DAY_END


def test_coerce_downtime_null_reason_is_none():
    d = dal._coerce_downtime(_dt_row(reason_code=None, issue_type=None, issue_title=None), _DAY_START, _DAY_END)
    assert d["reasonCode"] is None
    assert d["issueType"] is None
    assert d["issueTitle"] is None


def test_coerce_downtime_zero_duration_gets_min_span():
    d = dal._coerce_downtime(_dt_row(duration_s="0"), _DAY_START, _DAY_END)
    assert d["end"] > d["start"]


# ---------------------------------------------------------------------------
# _build_kpis
# ---------------------------------------------------------------------------

def test_build_kpis_all_zeros_when_empty():
    kpis = dal._build_kpis([], [])
    assert kpis["orderCount"] == 0
    assert kpis["completedCount"] == 0
    assert kpis["confirmedQty"] == 0.0
    assert kpis["downtimeEvents"] == 0
    assert kpis["downtimeMins"] == 0.0


def test_build_kpis_counts_correctly():
    blocks = [
        {"kind": "completed", "confirmedQty": 500.0},
        {"kind": "running", "confirmedQty": 200.0},
        {"kind": "onhold", "confirmedQty": 0.0},
    ]
    start = _DAY_START
    downtime = [
        {"start": start, "end": start + 30 * 60 * 1000},
        {"start": start, "end": start + 60 * 60 * 1000},
    ]
    kpis = dal._build_kpis(blocks, downtime)
    assert kpis["orderCount"] == 3
    assert kpis["completedCount"] == 1
    assert kpis["confirmedQty"] == 700.0
    assert kpis["downtimeEvents"] == 2
    assert kpis["downtimeMins"] == 90.0


# ---------------------------------------------------------------------------
# fetch_day_view — integration (mocked run_sql_async)
# ---------------------------------------------------------------------------

_BLOCK_ROW = {
    "process_order_id": "PO001",
    "line_id": "LINE-01",
    "order_status": "COMPLETED",
    "planned_qty": "1000.0",
    "confirmed_qty": "980.0",
    "material_id": "MAT-001",
    "material_name": "Whey Protein",
    "first_ms": str(_DAY_START + 2 * 3_600_000),
    "last_ms": str(_DAY_START + 6 * 3_600_000),
}

_DOWNTIME_ROW = {
    "process_order_id": "PO001",
    "line_id": "LINE-01",
    "start_ms": str(_DAY_START + 3 * 3_600_000),
    "duration_s": "900",
    "reason_code": "RC01",
    "issue_type": "breakdown",
    "issue_title": "Pump fault",
}


def _make_sql_mock(call_results: list[list[dict]]):
    call_iter = iter(call_results)

    async def fake_run_sql_async(_token, _query, _params=None, **_kwargs):
        return next(call_iter)

    return fake_run_sql_async


def test_fetch_day_view_returns_full_shape(monkeypatch):
    monkeypatch.setattr(dal, "run_sql_async", _make_sql_mock([[_BLOCK_ROW], [_DOWNTIME_ROW]]))
    result = asyncio.run(dal.fetch_day_view("token", day="2026-04-29"))
    assert result["day"] == "2026-04-29"
    assert "day_start_ms" in result
    assert "day_end_ms" in result
    assert result["lines"] == ["LINE-01"]
    assert len(result["blocks"]) == 1
    assert len(result["downtime"]) == 1
    assert result["kpis"]["orderCount"] == 1
    assert result["kpis"]["completedCount"] == 1


def test_fetch_day_view_empty_data(monkeypatch):
    monkeypatch.setattr(dal, "run_sql_async", _make_sql_mock([[], []]))
    result = asyncio.run(dal.fetch_day_view("token", day="2026-04-29"))
    assert result["blocks"] == []
    assert result["downtime"] == []
    assert result["lines"] == []
    assert result["kpis"]["orderCount"] == 0


def test_fetch_day_view_lines_from_downtime_without_blocks(monkeypatch):
    dt_only = {**_DOWNTIME_ROW, "line_id": "LINE-99"}
    monkeypatch.setattr(dal, "run_sql_async", _make_sql_mock([[], [dt_only]]))
    result = asyncio.run(dal.fetch_day_view("token", day="2026-04-29"))
    assert "LINE-99" in result["lines"]
    assert result["blocks"] == []


def test_fetch_day_view_defaults_to_today_when_no_day(monkeypatch):
    monkeypatch.setattr(dal, "run_sql_async", _make_sql_mock([[], []]))
    result = asyncio.run(dal.fetch_day_view("token"))
    from datetime import date
    date.fromisoformat(result["day"])  # must be a valid date
