"""API smoke tests for Template Module."""
from fastapi.testclient import TestClient

from template_backend.module_template.application.services import create_module_template_service
from template_backend.module_template.infrastructure.dependencies import get_module_template_service
from template_backend.main import app


_service = create_module_template_service()
app.dependency_overrides[get_module_template_service] = lambda: _service


def test_overview_returns_demo_metrics() -> None:
    """The generated bounded context exposes a demo-ready overview endpoint."""
    response = TestClient(app).get("/api/module-template/overview")

    assert response.status_code == 200
    payload = response.json()
    assert payload["data_available"] is True
    assert payload["plant_id"] == "DEMO"
    assert len(payload["metrics"]) >= 1


def test_signal_crud_endpoints_are_demo_ready() -> None:
    """Generated CRUD-style signal routes work before live Databricks wiring."""
    client = TestClient(app)

    created = client.post(
        "/api/module-template/signals",
        json={"plant_id": "DEMO", "title": "Investigate supplier hold", "status": "open"},
    )
    assert created.status_code == 201
    signal_id = created.json()["signal_id"]

    listed = client.get("/api/module-template/signals")
    assert listed.status_code == 200
    assert any(signal["signal_id"] == signal_id for signal in listed.json())

    updated = client.patch(f"/api/module-template/signals/{signal_id}/status", json={"status": "closed"})
    assert updated.status_code == 200
    assert updated.json()["status"] == "closed"
