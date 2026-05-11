"""Unit tests for ConnectedQuality lab application services."""

from __future__ import annotations

from shared_manufacturing import test_data
from connectedquality_backend.application import lab


async def test_fetch_lab_failures_normalizes_rows(monkeypatch) -> None:
    """The application layer maps raw DAL rows into the Lab Board API contract."""
    plant = test_data.PLANTS[0]
    mat_id = test_data.material_id()
    lot_id = test_data.inspection_lot()
    b_id = test_data.batch_id()
    mic = test_data.mic_id()

    async def _fake_fetch(token: str, *, plant_id: str, lot_type: str | None) -> list[dict]:
        assert token == "token"
        assert plant_id == plant
        assert lot_type == "89"
        return [
            {
                "material_name": "Sample Material",
                "material_id": mat_id,
                "inspection_lot_id": lot_id,
                "batch_id": b_id,
                "process_line": "Line A",
                "characteristic_id": mic,
                "characteristic_description": "Moisture",
                "quantitative_result": "12.5",
                "lower_limit": "10.0",
                "upper_limit": "13.0",
                "uom": "%",
                "judgement": "W",
            }
        ]

    monkeypatch.setattr(lab, "fetch_lab_failure_rows", _fake_fetch)

    assert await lab.fetch_lab_failures("token", plant_id=plant, lot_type="89") == {
        "plant_id": plant,
        "lot_type": "89",
        "fails": [
            {
                "mat": "Sample Material",
                "matNo": mat_id,
                "lot": lot_id,
                "batch": b_id,
                "line": "Line A",
                "char": mic,
                "text": "Moisture",
                "res": 12.5,
                "lo": 10.0,
                "hi": 13.0,
                "units": "%",
                "sev": "warn",
            }
        ],
        "data_available": True,
    }


async def test_fetch_lab_plants_wraps_dal_rows(monkeypatch) -> None:
    """The application layer owns the transport-facing plants payload shape."""
    plant = test_data.PLANTS[0]

    async def _fake_fetch(token: str) -> list[dict]:
        assert token == "token"
        return [{"plant_id": plant, "plant_name": "Charleville"}]

    monkeypatch.setattr(lab, "fetch_lab_plant_rows", _fake_fetch)

    assert await lab.fetch_lab_plants("token") == {
        "plants": [{"plant_id": plant, "plant_name": "Charleville"}]
    }
