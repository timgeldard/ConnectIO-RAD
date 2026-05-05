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
async def test_control_tower_queries_enrichment(monkeypatch):
    """Verify KPI rows are correctly enriched with health status."""

    async def fake_fetch(token, plant_id=None):
        return [
            {"kpi_id": "K1", "kpi_value": 0.95},  # Healthy
            {"kpi_id": "K2", "kpi_value": "0.85"},  # Warning (string conversion)
            {"kpi_id": "K3", "kpi_value": 0.75},  # Critical
            {"kpi_id": "K4", "kpi_value": "invalid"},  # Fallback
            {"kpi_id": "K5", "kpi_value": None},  # None
        ]

    monkeypatch.setattr(control_tower_queries.kpis_dal, "fetch_kpis", fake_fetch)

    result = await control_tower_queries.list_kpis("token", "DE01")
    assert result[0]["kpi_health"] == "HEALTHY"
    assert result[1]["kpi_health"] == "WARNING"
    assert result[2]["kpi_health"] == "CRITICAL"
    assert result[3]["kpi_health"] == "HEALTHY"
    assert result[4]["kpi_health"] == "HEALTHY"


@pytest.mark.asyncio
async def test_order_fulfillment_list_queries_enrichment(monkeypatch):
    """Verify delivery and process order rows are enriched with normalized status."""

    async def fake_deliveries(token, plant_id=None):
        return [{"delivery_id": "D1", "delivery_status": "SHIPPED"}]

    async def fake_orders(token, plant_id=None):
        return [{"order_id": "P1", "order_status": "REL"}]

    monkeypatch.setattr(fulfillment_queries.deliveries_dal, "fetch_deliveries", fake_deliveries)
    monkeypatch.setattr(fulfillment_queries.process_orders_dal, "fetch_process_orders", fake_orders)

    deliveries = await fulfillment_queries.list_deliveries("token", "FR01")
    assert deliveries[0]["delivery_status_normalized"] == "SHIPPED"
    assert deliveries[0]["is_active"] is False

    orders = await fulfillment_queries.list_process_orders("token", "FR01")
    assert orders[0]["po_status_normalized"] == "RELEASED"
    assert orders[0]["is_open"] is True


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
