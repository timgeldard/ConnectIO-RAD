"""Application query tests for process order execution."""

import pytest

from backend.order_execution.application import queries


@pytest.mark.asyncio
async def test_list_orders_delegates_to_dal(monkeypatch):
    calls = []

    async def fake_fetch_orders_list(token, *, plant_id, limit):
        calls.append((token, plant_id, limit))
        return [{"process_order_id": "PO-1"}]

    monkeypatch.setattr(queries.orders_dal, "fetch_orders_list", fake_fetch_orders_list)

    assert await queries.list_orders("token", plant_id="P1", limit=50) == [{"process_order_id": "PO-1"}]
    assert calls == [("token", "P1", 50)]


@pytest.mark.asyncio
async def test_get_order_detail_delegates_to_dal(monkeypatch):
    calls = []

    async def fake_fetch_order_detail(token, *, order_id):
        calls.append((token, order_id))
        return {"order": {"process_order_id": order_id}}

    monkeypatch.setattr(queries.order_detail_dal, "fetch_order_detail", fake_fetch_order_detail)

    assert await queries.get_order_detail("token", order_id="PO-1") == {"order": {"process_order_id": "PO-1"}}
    assert calls == [("token", "PO-1")]


@pytest.mark.asyncio
async def test_get_day_view_delegates_to_dal(monkeypatch):
    calls = []

    async def fake_fetch_day_view(token, *, day, plant_id):
        calls.append((token, day, plant_id))
        return {"day": day}

    monkeypatch.setattr(queries.day_view_dal, "fetch_day_view", fake_fetch_day_view)

    assert await queries.get_day_view("token", day="2026-04-29", plant_id="P1") == {"day": "2026-04-29"}
    assert calls == [("token", "2026-04-29", "P1")]


@pytest.mark.asyncio
async def test_get_pours_analytics_delegates_to_dal(monkeypatch):
    calls = []

    async def fake_fetch_pours_analytics(token, *, plant_id, date_from, date_to, timezone):
        calls.append((token, plant_id, date_from, date_to, timezone))
        return {"timezone": timezone}

    monkeypatch.setattr(queries.pours_analytics_dal, "fetch_pours_analytics", fake_fetch_pours_analytics)

    result = await queries.get_pours_analytics(
        "token",
        plant_id="P1",
        date_from="2026-04-01",
        date_to="2026-04-30",
        timezone="Europe/Dublin",
    )

    assert result == {"timezone": "Europe/Dublin"}
    assert calls == [("token", "P1", "2026-04-01", "2026-04-30", "Europe/Dublin")]
