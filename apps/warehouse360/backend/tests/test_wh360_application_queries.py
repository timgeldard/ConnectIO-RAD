"""Application query tests for Warehouse360 non-inventory contexts."""

import pytest

from backend.dispensary_ops.application import queries as dispensary_queries
from backend.operations_control_tower.application import queries as control_tower_queries
from backend.order_fulfillment.application import queries as fulfillment_queries


@pytest.mark.asyncio
async def test_dispensary_queries_normalize_plant_scope(monkeypatch):
    calls = []

    async def fake_fetch(token, plant_id=None):
        calls.append((token, plant_id))
        return [{"task_id": "T1"}]

    monkeypatch.setattr(dispensary_queries.dispensary_dal, "fetch_dispensary_tasks", fake_fetch)

    result = await dispensary_queries.list_dispensary_tasks("token", " IE01 ")
    assert calls == [("token", "IE01")]
    assert result[0]["task_id"] == "T1"
    assert "status_normalized" in result[0]
    assert "is_urgent" in result[0]


@pytest.mark.asyncio
async def test_control_tower_queries_normalize_plant_scope(monkeypatch):
    calls = []

    async def fake_fetch(token, plant_id=None):
        calls.append((token, plant_id))
        return [{"plant_id": "DE01"}]

    monkeypatch.setattr(control_tower_queries.kpis_dal, "fetch_kpis", fake_fetch)

    result = await control_tower_queries.list_kpis("token", " DE01 ")
    assert calls == [("token", "DE01")]
    assert result[0]["plant_id"] == "DE01"
    assert "kpi_health" in result[0]


@pytest.mark.asyncio
async def test_order_fulfillment_list_queries_normalize_plant_scope(monkeypatch):
    calls = []

    async def fake_deliveries(token, plant_id=None):
        calls.append(("deliveries", token, plant_id))
        return []

    async def fake_orders(token, plant_id=None):
        calls.append(("orders", token, plant_id))
        return []

    monkeypatch.setattr(fulfillment_queries.deliveries_dal, "fetch_deliveries", fake_deliveries)
    monkeypatch.setattr(fulfillment_queries.process_orders_dal, "fetch_process_orders", fake_orders)

    assert await fulfillment_queries.list_deliveries("token", " FR01 ") == []
    assert await fulfillment_queries.list_process_orders("token", " ") == []
    assert calls == [("deliveries", "token", "FR01"), ("orders", "token", None)]


@pytest.mark.asyncio
async def test_order_fulfillment_detail_queries_delegate(monkeypatch):
    calls = []

    async def fake_delivery_detail(token, delivery_id):
        calls.append(("delivery", token, delivery_id))
        return {"delivery": {"delivery_id": delivery_id}}

    async def fake_order_detail(token, order_id):
        calls.append(("order", token, order_id))
        return {"order": {"order_id": order_id}}

    monkeypatch.setattr(fulfillment_queries.deliveries_dal, "fetch_delivery_detail", fake_delivery_detail)
    monkeypatch.setattr(fulfillment_queries.process_orders_dal, "fetch_order_detail", fake_order_detail)

    assert await fulfillment_queries.get_delivery_detail("token", "8001") == {"delivery": {"delivery_id": "8001"}}
    assert await fulfillment_queries.get_process_order_detail("token", "1001") == {"order": {"order_id": "1001"}}
    assert calls == [("delivery", "token", "8001"), ("order", "token", "1001")]
