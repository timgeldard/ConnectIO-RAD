"""Unit tests for POH plant application services."""

from __future__ import annotations

from processorderhistory_backend.order_execution.application import plant_queries


async def test_list_visible_plants_wraps_dal_rows(monkeypatch) -> None:
    """The application layer owns the plants payload returned by the router."""

    async def _fake_fetch(token: str) -> list[dict]:
        assert token == "token"
        return [{"plant_id": "P001", "plant_name": "Plant 1"}]

    monkeypatch.setattr(plant_queries, "fetch_plant_rows", _fake_fetch)

    assert await plant_queries.list_visible_plants("token") == {
        "plants": [{"plant_id": "P001", "plant_name": "Plant 1"}]
    }
