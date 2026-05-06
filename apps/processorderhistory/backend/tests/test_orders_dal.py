"""Unit tests for orders_dal — _coerce_row helper and fetch_orders_list."""
import asyncio

from processorderhistory_backend.order_execution.dal import orders_dal as dal


# ---------------------------------------------------------------------------
# _coerce_row
# ---------------------------------------------------------------------------

def test_coerce_row_converts_all_numeric_fields():
    row = {
        "actual_qty": "250.5",
        "start_ms": "1700000000000",
        "end_ms": "1700003600000",
        "duration_h": "1.0",
    }
    result = dal._coerce_row(row)
    assert result["actual_qty"] == 250.5
    assert result["start_ms"] == 1700000000000
    assert result["end_ms"] == 1700003600000
    assert result["duration_h"] == 1.0


def test_coerce_row_handles_all_nulls():
    row = {"actual_qty": None, "start_ms": None, "end_ms": None, "duration_h": None}
    result = dal._coerce_row(row)
    assert result["actual_qty"] is None
    assert result["start_ms"] is None
    assert result["end_ms"] is None
    assert result["duration_h"] is None


def test_coerce_row_actual_qty_is_float():
    row = {"actual_qty": "100", "start_ms": None, "end_ms": None, "duration_h": None}
    assert isinstance(dal._coerce_row(row)["actual_qty"], float)


def test_coerce_row_start_ms_is_int():
    row = {"actual_qty": None, "start_ms": "1700000000000", "end_ms": None, "duration_h": None}
    assert isinstance(dal._coerce_row(row)["start_ms"], int)


def test_coerce_row_end_ms_is_int():
    row = {"actual_qty": None, "start_ms": None, "end_ms": "1700003600000", "duration_h": None}
    assert isinstance(dal._coerce_row(row)["end_ms"], int)


def test_coerce_row_duration_h_is_float():
    row = {"actual_qty": None, "start_ms": None, "end_ms": None, "duration_h": "2"}
    assert isinstance(dal._coerce_row(row)["duration_h"], float)


# ---------------------------------------------------------------------------
# fetch_orders_list — integration (mocked run_sql_async)
# ---------------------------------------------------------------------------

_ORDER_ROW = {
    "process_order_id": "PO-001",
    "inspection_lot_id": "LOT-001",
    "material_id": "MAT-001",
    "material_name": "Test Product",
    "material_category": "Dairy",
    "plant_id": "P001",
    "status": "running",
    "start_ms": 1700000000000,
    "end_ms": 1700003600000,
    "duration_h": 1.0,
    "actual_qty": 250.5,
    "qty_uom": "KG",
}


def _make_sql_mock(rows: list[dict]):
    async def fake_run_sql_async(_token, _query, _params=None, **_kwargs):
        return rows
    return fake_run_sql_async


def test_fetch_orders_list_returns_coerced_rows(monkeypatch):
    raw_row = {
        **_ORDER_ROW,
        "actual_qty": "250.5",
        "start_ms": "1700000000000",
        "end_ms": "1700003600000",
        "duration_h": "1.0",
    }
    monkeypatch.setattr(dal, "run_sql_async", _make_sql_mock([raw_row]))
    result = asyncio.run(dal.fetch_orders_list("token"))
    assert len(result) == 1
    assert result[0]["process_order_id"] == "PO-001"
    assert result[0]["actual_qty"] == 250.5
    assert isinstance(result[0]["actual_qty"], float)
    assert result[0]["start_ms"] == 1700000000000
    assert isinstance(result[0]["start_ms"], int)


def test_fetch_orders_list_returns_empty_list(monkeypatch):
    monkeypatch.setattr(dal, "run_sql_async", _make_sql_mock([]))
    result = asyncio.run(dal.fetch_orders_list("token"))
    assert result == []


def test_fetch_orders_list_handles_null_fields(monkeypatch):
    null_row = {**_ORDER_ROW, "actual_qty": None, "start_ms": None, "end_ms": None, "duration_h": None}
    monkeypatch.setattr(dal, "run_sql_async", _make_sql_mock([null_row]))
    result = asyncio.run(dal.fetch_orders_list("token"))
    assert result[0]["actual_qty"] is None
    assert result[0]["start_ms"] is None
    assert result[0]["end_ms"] is None
    assert result[0]["duration_h"] is None


def test_fetch_orders_list_with_plant_id_sends_params(monkeypatch):
    """Verify that plant_id and limit parameters are correctly passed to the SQL runner."""
    captured: list = []

    async def capture(_token, _query, params=None, **_kwargs):
        captured.append(params)
        return [_ORDER_ROW]

    monkeypatch.setattr(dal, "run_sql_async", capture)
    asyncio.run(dal.fetch_orders_list("token", plant_id="P001"))
    # Now expects 2 params: limit and plant_id
    assert len(captured[0]) == 2
    assert any(p["name"] == "plant_id" and p["value"] == "P001" for p in captured[0])
    assert any(p["name"] == "limit" and p["value"] == "2000" for p in captured[0])


def test_fetch_orders_list_without_plant_id_sends_limit_param(monkeypatch):
    """Verify that only the limit parameter is passed when plant_id is omitted."""
    captured: list = []

    async def capture(_token, _query, params=None, **_kwargs):
        captured.append(params)
        return []

    monkeypatch.setattr(dal, "run_sql_async", capture)
    asyncio.run(dal.fetch_orders_list("token"))
    assert len(captured[0]) == 1
    assert captured[0][0]["name"] == "limit"


def test_fetch_orders_list_multiple_orders_all_coerced(monkeypatch):
    row2 = {
        **_ORDER_ROW,
        "process_order_id": "PO-002",
        "status": "completed",
        "actual_qty": "0.0",
        "start_ms": "1700007200000",
        "end_ms": None,
        "duration_h": None,
    }
    monkeypatch.setattr(dal, "run_sql_async", _make_sql_mock([_ORDER_ROW, row2]))
    result = asyncio.run(dal.fetch_orders_list("token", limit=10))
    assert len(result) == 2
    ids = {r["process_order_id"] for r in result}
    assert ids == {"PO-001", "PO-002"}
    po2 = next(r for r in result if r["process_order_id"] == "PO-002")
    assert po2["actual_qty"] == 0.0
    assert po2["end_ms"] is None


def test_fetch_orders_list_preserves_non_coerced_fields(monkeypatch):
    monkeypatch.setattr(dal, "run_sql_async", _make_sql_mock([_ORDER_ROW]))
    result = asyncio.run(dal.fetch_orders_list("token"))
    row = result[0]
    assert row["material_name"] == "Test Product"
    assert row["status"] == "running"
    assert row["qty_uom"] == "KG"
    assert row["plant_id"] == "P001"
