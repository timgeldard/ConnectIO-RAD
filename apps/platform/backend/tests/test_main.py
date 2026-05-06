from fastapi.testclient import TestClient

import backend.main as main_module
from backend.main import app


def test_platform_imports_without_build_artifacts():
    response = TestClient(app).get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_platform_ready_reports_missing_build_artifacts():
    original = dict(main_module._missing_build_artifacts)
    main_module._missing_build_artifacts["test_artifact"] = "not installed"
    try:
        response = TestClient(app).get("/api/ready")
    finally:
        main_module._missing_build_artifacts.clear()
        main_module._missing_build_artifacts.update(original)

    assert response.status_code == 503
    assert response.json()["detail"]["reason"] == "platform_build_artifacts_missing"
