"""Unit tests for ConnectedQuality lab application services."""

from __future__ import annotations

from connectedquality_backend.application import lab


async def test_fetch_lab_failures_normalizes_rows(monkeypatch) -> None:
    """The application layer maps raw DAL rows into the Lab Board API contract."""

    async def _fake_fetch(token: str, *, plant_id: str, lot_type: str | None) -> list[dict]:
        assert token == "token"
        assert plant_id == "CHV"
        assert lot_type == "89"
        return [
            {
                "material_name": "Sample Material",
                "material_id": "MAT1",
                "inspection_lot_id": "LOT1",
                "batch_id": "B1",
                "process_line": "Line A",
                "characteristic_id": "MIC1",
                "characteristic_description": "Moisture",
                "quantitative_result": "12.5",
                "lower_limit": "10.0",
                "upper_limit": "13.0",
                "uom": "%",
                "judgement": "W",
            }
        ]

    monkeypatch.setattr(lab, "fetch_lab_failure_rows", _fake_fetch)

    assert await lab.fetch_lab_failures("token", plant_id="CHV", lot_type="89") == {
        "plant_id": "CHV",
        "lot_type": "89",
        "fails": [
            {
                "mat": "Sample Material",
                "matNo": "MAT1",
                "lot": "LOT1",
                "batch": "B1",
                "line": "Line A",
                "char": "MIC1",
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

    async def _fake_fetch(token: str) -> list[dict]:
        assert token == "token"
        return [{"plant_id": "CHV", "plant_name": "Charleville"}]

    monkeypatch.setattr(lab, "fetch_lab_plant_rows", _fake_fetch)

    assert await lab.fetch_lab_plants("token") == {
        "plants": [{"plant_id": "CHV", "plant_name": "Charleville"}]
    }
