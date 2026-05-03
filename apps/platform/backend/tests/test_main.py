from fastapi.testclient import TestClient

from backend.main import app


def test_platform_imports_without_build_artifacts():
    response = TestClient(app).get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_platform_ready_reports_missing_build_artifacts():
    response = TestClient(app).get("/api/ready")

    assert response.status_code == 503
    assert response.json()["detail"]["reason"] == "platform_build_artifacts_missing"
