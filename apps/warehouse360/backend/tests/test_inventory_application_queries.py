"""Application query tests for Warehouse360 inventory management."""

import pytest

from backend.inventory_management.application import queries


@pytest.mark.asyncio
async def test_list_bin_stock_normalizes_plant_scope(monkeypatch):
    calls = []

    async def fake_fetch_bin_stock(token, plant_id=None):
        calls.append((token, plant_id))
        return [{"bin_id": "A-01"}]

    monkeypatch.setattr(queries.inventory_dal, "fetch_bin_stock", fake_fetch_bin_stock)

    rows = await queries.list_bin_stock("token", plant_id=" IE01 ")

    assert rows == [{"bin_id": "A-01"}]
    assert calls == [("token", "IE01")]


@pytest.mark.asyncio
async def test_list_lineside_stock_blank_scope_fetches_all(monkeypatch):
    calls = []

    async def fake_fetch_lineside(token, plant_id=None):
        calls.append((token, plant_id))
        return []

    monkeypatch.setattr(queries.inventory_dal, "fetch_lineside", fake_fetch_lineside)

    rows = await queries.list_lineside_stock("token", plant_id=" ")

    assert rows == []
    assert calls == [("token", None)]


@pytest.mark.asyncio
async def test_list_inbound_receipts_normalizes_plant_scope(monkeypatch):
    calls = []

    async def fake_fetch_inbound(token, plant_id=None):
        calls.append((token, plant_id))
        return [{"po_id": "4501"}]

    monkeypatch.setattr(queries.inbound_dal, "fetch_inbound", fake_fetch_inbound)

    rows = await queries.list_inbound_receipts("token", plant_id="DE01")

    assert rows == [{"po_id": "4501"}]
    assert calls == [("token", "DE01")]


@pytest.mark.asyncio
async def test_get_receipt_detail_delegates_to_dal(monkeypatch):
    calls = []

    async def fake_fetch_receipt_detail(token, po_id):
        calls.append((token, po_id))
        return {"receipt": {"po_id": po_id}, "items": []}

    monkeypatch.setattr(queries.inbound_dal, "fetch_receipt_detail", fake_fetch_receipt_detail)

    detail = await queries.get_receipt_detail("token", "4501")

    assert detail["receipt"]["po_id"] == "4501"
    assert calls == [("token", "4501")]


@pytest.mark.asyncio
async def test_list_plants_delegates_to_dal(monkeypatch):
    async def fake_fetch_plants(token):
        assert token == "token"
        return [{"plant_id": "IE01"}]

    monkeypatch.setattr(queries.plants_dal, "fetch_plants", fake_fetch_plants)

    assert await queries.list_plants("token") == [{"plant_id": "IE01"}]
