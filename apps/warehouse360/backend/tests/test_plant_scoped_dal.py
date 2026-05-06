import pytest

from warehouse360_backend.order_fulfillment.dal import deliveries, process_orders
from warehouse360_backend.inventory_management.dal import inbound, inventory
from warehouse360_backend.operations_control_tower.dal import kpis


@pytest.mark.asyncio
async def test_fetch_kpi_snapshot_filters_by_plant(monkeypatch):
    calls = []

    async def fake_run_sql_async(token, statement, params, *, endpoint_hint):
        calls.append((token, statement, params, endpoint_hint))
        return [{"plant_id": "IE01", "orders_total": 3}]

    monkeypatch.setattr(kpis, "run_sql_async", fake_run_sql_async)

    result = await kpis.fetch_kpi_snapshot("token", plant_id="IE01")

    assert result["plant_id"] == "IE01"
    token, statement, params, endpoint_hint = calls[0]
    assert token == "token"
    assert endpoint_hint == "wh360.kpi_snapshot"
    assert "WHERE plant_id = :plant_id" in statement
    assert "ORDER BY plant_id" in statement
    assert params == [{"name": "plant_id", "value": "IE01", "type": "STRING"}]


@pytest.mark.asyncio
async def test_fetch_bin_stock_filters_by_plant(monkeypatch):
    calls = []

    async def fake_run_sql_async(token, statement, params, *, endpoint_hint):
        calls.append((token, statement, params, endpoint_hint))
        return [{"plant_id": "DE01", "bin_id": "A-01"}]

    monkeypatch.setattr(inventory, "run_sql_async", fake_run_sql_async)

    rows = await inventory.fetch_bin_stock("token", plant_id="DE01")

    assert rows == [{"plant_id": "DE01", "bin_id": "A-01"}]
    token, statement, params, endpoint_hint = calls[0]
    assert token == "token"
    assert endpoint_hint == "wh360.bin_stock"
    assert "WHERE plant_id = :plant_id" in statement
    assert params == [{"name": "plant_id", "value": "DE01", "type": "STRING"}]


@pytest.mark.asyncio
async def test_fetch_order_detail_uses_committed_view_columns(monkeypatch):
    calls = []

    async def fake_run_sql_async(token, statement, params, *, endpoint_hint):
        calls.append((statement, params, endpoint_hint))
        if endpoint_hint == "wh360.order_detail.header":
            return [{"order_id": "1001", "reservation_no": "R123"}]
        return []

    monkeypatch.setattr(process_orders, "run_sql_async", fake_run_sql_async)

    detail = await process_orders.fetch_order_detail("token", "1001")

    assert detail["order"]["reservation_no"] == "R123"
    statements = "\n".join(statement for statement, _, _ in calls)
    assert "WHERE order_id = :order_id" in statements
    assert "WHERE reservation_no = :reservation_no" in statements
    assert "ORDER BY created_date" in statements
    assert "process_order_id" not in statements
    assert "created_at" not in statements


@pytest.mark.asyncio
async def test_fetch_receipt_detail_uses_inbound_view_for_items(monkeypatch):
    calls = []

    async def fake_run_sql_async(token, statement, params, *, endpoint_hint):
        calls.append((statement, params, endpoint_hint))
        return [{"po_id": "4501", "po_item": "10"}]

    monkeypatch.setattr(inbound, "run_sql_async", fake_run_sql_async)

    detail = await inbound.fetch_receipt_detail("token", "4501")

    assert detail["receipt"]["po_id"] == "4501"
    assert detail["items"] == [{"po_id": "4501", "po_item": "10"}]
    statement, params, endpoint_hint = calls[0]
    assert endpoint_hint == "wh360.receipt_detail.items"
    assert "wh360_inbound_v" in statement
    assert "wh360_inbound_items_v" not in statement
    assert "ORDER BY po_item" in statement
    assert params == [{"name": "po_id", "value": "4501", "type": "STRING"}]


@pytest.mark.asyncio
async def test_fetch_delivery_detail_uses_delivery_id_and_created_date(monkeypatch):
    calls = []

    async def fake_run_sql_async(token, statement, params, *, endpoint_hint):
        calls.append((statement, params, endpoint_hint))
        if endpoint_hint == "wh360.delivery_detail.header":
            return [{"delivery_id": "8001"}]
        return []

    monkeypatch.setattr(deliveries, "run_sql_async", fake_run_sql_async)

    detail = await deliveries.fetch_delivery_detail("token", "8001")

    assert detail["delivery"]["delivery_id"] == "8001"
    statements = "\n".join(statement for statement, _, _ in calls)
    assert "WHERE delivery_id = :delivery_id" in statements
    assert "ORDER BY created_date" in statements
    assert "WHERE ref_doc = :delivery_id" not in statements
    assert "created_at" not in statements
