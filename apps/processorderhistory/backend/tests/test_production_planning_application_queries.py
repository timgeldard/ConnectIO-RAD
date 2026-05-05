"""Application query tests for production planning."""

import pytest

from processorderhistory_backend.production_planning.application import queries


@pytest.mark.asyncio
async def test_get_planning_schedule_delegates_to_dal(monkeypatch):
    calls = []

    async def fake_fetch(token, *, plant_id):
        calls.append((token, plant_id))
        return {"blocks": []}

    monkeypatch.setattr(queries.planning_dal, "fetch_planning_schedule", fake_fetch)

    assert await queries.get_planning_schedule("token", plant_id="P1") == {"blocks": []}
    assert calls == [("token", "P1")]


@pytest.mark.asyncio
async def test_get_vessel_planning_analytics_delegates_to_dal(monkeypatch):
    calls = []

    async def fake_fetch(token, *, plant_id, date_from, date_to, timezone):
        calls.append((token, plant_id, date_from, date_to, timezone))
        return {"vessels": []}

    monkeypatch.setattr(queries.vessel_planning_dal, "fetch_vessel_planning_analytics", fake_fetch)

    result = await queries.get_vessel_planning_analytics(
        "token",
        plant_id="P1",
        date_from="2026-04-01",
        date_to="2026-04-30",
        timezone="UTC",
    )

    assert result == {"vessels": []}
    assert calls == [("token", "P1", "2026-04-01", "2026-04-30", "UTC")]
