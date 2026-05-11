"""Application query tests for Warehouse360 inventory management."""

import pytest
from shared_domain import test_data

from warehouse360_backend.inventory_management.application import queries
from warehouse360_backend.inventory_management.router_imwm import _resolve_plant_scope


@pytest.mark.asyncio
async def test_list_bin_stock_normalizes_plant_scope(monkeypatch):
    calls = []
    plant = test_data.PLANTS[0]

    async def fake_fetch_bin_stock(token, plant_id=None, lgtyp=None):
        calls.append((token, plant_id, lgtyp))
        return [{"bin_id": "A-01"}]

    monkeypatch.setattr(queries.inventory_dal, "fetch_bin_stock", fake_fetch_bin_stock)

    rows = await queries.list_bin_stock("token", plant_id=f" {plant} ")

    assert rows == [{"bin_id": "A-01"}]
    assert calls == [("token", plant, None)]


@pytest.mark.asyncio
async def test_list_bin_stock_passes_lgtyp_filter(monkeypatch):
    calls = []
    plant = test_data.PLANTS[0]

    async def fake_fetch_bin_stock(token, plant_id=None, lgtyp=None):
        calls.append((token, plant_id, lgtyp))
        return [{"bin_id": "B-01"}]

    monkeypatch.setattr(queries.inventory_dal, "fetch_bin_stock", fake_fetch_bin_stock)

    rows = await queries.list_bin_stock("token", plant_id=plant, lgtyp="100")

    assert rows == [{"bin_id": "B-01"}]
    assert calls == [("token", plant, "100")]


@pytest.mark.asyncio
async def test_list_bin_stock_summary_normalizes_plant_scope(monkeypatch):
    calls = []
    plant = test_data.PLANTS[0]

    async def fake_fetch_summary(token, plant_id=None):
        calls.append((token, plant_id))
        return [{"lgtyp": "100", "total_bins": 500, "occupied_bins": 350, "free_bins": 130, "blocked_bins": 20}]

    monkeypatch.setattr(queries.inventory_dal, "fetch_bin_stock_summary", fake_fetch_summary)

    rows = await queries.list_bin_stock_summary("token", plant_id=f" {plant} ")

    assert rows[0]["lgtyp"] == "100"
    assert calls == [("token", plant)]


@pytest.mark.asyncio
async def test_list_bin_stock_summary_blank_scope_fetches_all(monkeypatch):
    calls = []

    async def fake_fetch_summary(token, plant_id=None):
        calls.append((token, plant_id))
        return []

    monkeypatch.setattr(queries.inventory_dal, "fetch_bin_stock_summary", fake_fetch_summary)

    await queries.list_bin_stock_summary("token", plant_id=" ")

    assert calls == [("token", None)]


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
    plant = test_data.PLANTS[1]

    async def fake_fetch_inbound(token, plant_id=None):
        calls.append((token, plant_id))
        return [{"po_id": "4501"}]

    monkeypatch.setattr(queries.inbound_dal, "fetch_inbound", fake_fetch_inbound)

    rows = await queries.list_inbound_receipts("token", plant_id=plant)

    assert rows == [{"po_id": "4501"}]
    assert calls == [("token", plant)]


@pytest.mark.asyncio
async def test_get_receipt_detail_delegates_to_dal(monkeypatch):
    calls = []
    po_id = test_data.process_order()

    async def fake_fetch_receipt_detail(token, po_id):
        calls.append((token, po_id))
        return {"receipt": {"po_id": po_id}, "items": []}

    monkeypatch.setattr(queries.inbound_dal, "fetch_receipt_detail", fake_fetch_receipt_detail)

    detail = await queries.get_receipt_detail("token", po_id)

    assert detail["receipt"]["po_id"] == po_id
    assert calls == [("token", po_id)]


@pytest.mark.asyncio
async def test_list_near_expiry_batches_normalizes_plant_scope(monkeypatch):
    calls = []
    plant = test_data.PLANTS[0]
    b_id = test_data.batch_id()

    async def fake_fetch_near_expiry(token, plant_id=None):
        calls.append((token, plant_id))
        return [{"batch_id": b_id, "days_to_expiry": 14}]

    monkeypatch.setattr(queries.inventory_dal, "fetch_near_expiry_batches", fake_fetch_near_expiry)

    rows = await queries.list_near_expiry_batches("token", plant_id=f" {plant} ")

    assert rows == [{"batch_id": b_id, "days_to_expiry": 14}]
    assert calls == [("token", plant)]


@pytest.mark.asyncio
async def test_list_near_expiry_batches_blank_scope_fetches_all(monkeypatch):
    calls = []

    async def fake_fetch_near_expiry(token, plant_id=None):
        calls.append((token, plant_id))
        return []

    monkeypatch.setattr(queries.inventory_dal, "fetch_near_expiry_batches", fake_fetch_near_expiry)

    rows = await queries.list_near_expiry_batches("token", plant_id=" ")

    assert rows == []
    assert calls == [("token", None)]


@pytest.mark.asyncio
async def test_list_plants_delegates_to_dal(monkeypatch):
    plant = test_data.PLANTS[0]
    async def fake_fetch_plants(token):
        assert token == "token"
        return [{"plant_id": plant}]

    monkeypatch.setattr(queries.plants_dal, "fetch_plants", fake_fetch_plants)

    assert await queries.list_plants("token") == [{"plant_id": plant}]


def test_imwm_router_accepts_warehouse360_plant_context_param():
    plant1 = test_data.PLANTS[0]
    plant2 = test_data.PLANTS[1]
    assert _resolve_plant_scope(None, plant1) == plant1
    assert _resolve_plant_scope("", plant2) == plant2
    assert _resolve_plant_scope("US01", plant2) == "US01"


# --- IMWM application-layer tests --------------------------------------------
# Mirrors the bin/lineside/inbound pattern above: confirm each handler
# (a) delegates to the matching DAL function and (b) normalises plant_id
# through PlantScope before doing so.


@pytest.mark.asyncio
async def test_list_imwm_stock_normalizes_plant_scope(monkeypatch):
    calls = []
    plant = test_data.PLANTS[0]

    async def fake_fetch_imwm_stock(token, plant_id=None):
        calls.append((token, plant_id))
        return [{"plant_id": plant}]

    monkeypatch.setattr(queries.imwm_dal, "fetch_imwm_stock", fake_fetch_imwm_stock)

    rows = await queries.list_imwm_stock("token", plant_id=f" {plant} ")

    assert rows == [{"plant_id": plant}]
    assert calls == [("token", plant)]


@pytest.mark.asyncio
async def test_list_imwm_movements_blank_scope_fetches_all(monkeypatch):
    calls = []

    async def fake_fetch_imwm_movements(token, plant_id=None):
        calls.append((token, plant_id))
        return []

    monkeypatch.setattr(queries.imwm_dal, "fetch_imwm_movements", fake_fetch_imwm_movements)

    rows = await queries.list_imwm_movements("token", plant_id=" ")

    assert rows == []
    assert calls == [("token", None)]


@pytest.mark.asyncio
async def test_list_imwm_exceptions_normalizes_plant_scope(monkeypatch):
    calls = []
    plant = test_data.PLANTS[1]

    async def fake_fetch_imwm_exceptions(token, plant_id=None):
        calls.append((token, plant_id))
        return [{"exception_type": "NEGATIVE_WM_QUANT"}]

    monkeypatch.setattr(queries.imwm_dal, "fetch_imwm_exceptions", fake_fetch_imwm_exceptions)

    rows = await queries.list_imwm_exceptions("token", plant_id=plant)

    assert rows == [{"exception_type": "NEGATIVE_WM_QUANT"}]
    assert calls == [("token", plant)]


@pytest.mark.asyncio
async def test_list_imwm_aging_delegates_to_dal(monkeypatch):
    plant = test_data.PLANTS[0]
    async def fake_fetch_imwm_aging(token, plant_id=None):
        assert token == "token"
        return [{"plant_id": plant, "age_bucket": "0-30d"}]

    monkeypatch.setattr(queries.imwm_dal, "fetch_imwm_aging", fake_fetch_imwm_aging)

    rows = await queries.list_imwm_aging("token")

    assert rows == [{"plant_id": plant, "age_bucket": "0-30d"}]
