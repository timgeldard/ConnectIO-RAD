"""Application query tests for manufacturing analytics."""

import pytest

from processorderhistory_backend.manufacturing_analytics.application import queries


@pytest.mark.asyncio
async def test_get_adherence_analytics_delegates_to_dal(monkeypatch):
    calls = []

    async def fake_fetch(token, *, plant_id, date_from, date_to, timezone):
        calls.append((token, plant_id, date_from, date_to, timezone))
        return {"kind": "adherence"}

    monkeypatch.setattr(queries.adherence_analytics_dal, "fetch_adherence_analytics", fake_fetch)

    result = await queries.get_adherence_analytics(
        "token", plant_id="P1", date_from="2026-04-01", date_to="2026-04-30", timezone="Europe/Dublin"
    )

    assert result == {"kind": "adherence"}
    assert calls == [("token", "P1", "2026-04-01", "2026-04-30", "Europe/Dublin")]


@pytest.mark.asyncio
async def test_get_downtime_analytics_delegates_to_dal(monkeypatch):
    async def fake_fetch(token, *, plant_id, date_from, date_to, timezone):
        return {"args": [token, plant_id, date_from, date_to, timezone]}

    monkeypatch.setattr(queries.downtime_analytics_dal, "fetch_downtime_analytics", fake_fetch)

    assert await queries.get_downtime_analytics(
        "token", plant_id=None, date_from=None, date_to=None, timezone="UTC"
    ) == {"args": ["token", None, None, None, "UTC"]}


@pytest.mark.asyncio
async def test_get_equipment_insights_delegates_to_dal(monkeypatch):
    calls = []

    async def fake_fetch(token, *, plant_id, timezone):
        calls.append((token, plant_id, timezone))
        return {"equipment": []}

    monkeypatch.setattr(queries.equipment_insights_dal, "fetch_equipment_insights", fake_fetch)

    assert await queries.get_equipment_insights("token", plant_id="P1", timezone="UTC") == {"equipment": []}
    assert calls == [("token", "P1", "UTC")]


@pytest.mark.asyncio
async def test_get_equipment_insights2_delegates_to_dal(monkeypatch):
    async def fake_fetch(token, *, plant_id, timezone):
        return {"args": [token, plant_id, timezone]}

    monkeypatch.setattr(queries.equipment_insights2_dal, "fetch_equipment_insights2", fake_fetch)

    assert await queries.get_equipment_insights2("token", plant_id=None, timezone="Europe/Dublin") == {
        "args": ["token", None, "Europe/Dublin"]
    }


@pytest.mark.asyncio
async def test_get_oee_quality_and_yield_delegate_to_dals(monkeypatch):
    calls = []

    async def fake_oee(token, *, plant_id, date_from, date_to, timezone):
        calls.append(("oee", token, plant_id, date_from, date_to, timezone))
        return {"oee": []}

    async def fake_quality(token, *, plant_id, date_from, date_to, timezone):
        calls.append(("quality", token, plant_id, date_from, date_to, timezone))
        return {"quality": []}

    async def fake_yield(token, *, plant_id, date_from, date_to, timezone):
        calls.append(("yield", token, plant_id, date_from, date_to, timezone))
        return {"yield": []}

    monkeypatch.setattr(queries.oee_analytics_dal, "fetch_oee_analytics", fake_oee)
    monkeypatch.setattr(queries.quality_analytics_dal, "fetch_quality_analytics", fake_quality)
    monkeypatch.setattr(queries.yield_analytics_dal, "fetch_yield_analytics", fake_yield)

    assert await queries.get_oee_analytics(
        "token", plant_id="P1", date_from="2026-04-01", date_to="2026-04-30", timezone="UTC"
    ) == {"oee": []}
    assert await queries.get_quality_analytics(
        "token", plant_id="P1", date_from="2026-04-01", date_to="2026-04-30", timezone="UTC"
    ) == {"quality": []}
    assert await queries.get_yield_analytics(
        "token", plant_id="P1", date_from="2026-04-01", date_to="2026-04-30", timezone="UTC"
    ) == {"yield": []}
    assert calls == [
        ("oee", "token", "P1", "2026-04-01", "2026-04-30", "UTC"),
        ("quality", "token", "P1", "2026-04-01", "2026-04-30", "UTC"),
        ("yield", "token", "P1", "2026-04-01", "2026-04-30", "UTC"),
    ]
