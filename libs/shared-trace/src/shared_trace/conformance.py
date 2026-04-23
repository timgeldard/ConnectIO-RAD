from __future__ import annotations

from collections.abc import Callable
from types import ModuleType
from typing import Any
from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

from shared_trace.freshness_sources import CORE_TRACE_FRESHNESS_SOURCES


def install_core_trace_route_stubs(
    monkeypatch: Any,
    trace_router_module: ModuleType,
) -> list[dict[str, Any]]:
    freshness_calls: list[dict[str, Any]] = []

    async def attach_payload(payload: dict[str, Any], token: str, request_path: str, source_views: list[str]):
        freshness_calls.append(
            {
                "payload": payload,
                "token": token,
                "request_path": request_path,
                "source_views": tuple(source_views),
            }
        )
        return payload

    monkeypatch.setattr(trace_router_module, "resolve_token", lambda *_args, **_kwargs: "token")
    monkeypatch.setattr(trace_router_module, "check_warehouse_config", lambda: None)
    monkeypatch.setattr(trace_router_module, "attach_payload_freshness", attach_payload)
    monkeypatch.setattr(
        trace_router_module,
        "fetch_trace_tree",
        AsyncMock(
            return_value=[
                {
                    "material_id": "MAT1",
                    "batch_id": "B1",
                    "parent_material_id": None,
                    "parent_batch_id": None,
                    "depth": 0,
                    "release_status": "Released",
                    "plant_name": "Plant 1",
                }
            ]
        ),
    )
    monkeypatch.setattr(trace_router_module, "fetch_summary", AsyncMock(return_value={"batch_id": "B1"}))
    monkeypatch.setattr(
        trace_router_module,
        "fetch_batch_details",
        AsyncMock(return_value={"summary": {"batch_id": "B1"}}),
    )
    monkeypatch.setattr(trace_router_module, "fetch_impact", AsyncMock(return_value={"downstream": []}))
    return freshness_calls


def assert_core_trace_route_contract(
    client: TestClient,
    freshness_calls: list[dict[str, Any]],
    *,
    assert_response: Callable[[str, dict[str, Any]], None] | None = None,
) -> None:
    cases = [
        (
            "/api/trace",
            {"material_id": "MAT1", "batch_id": "B1"},
            "trace",
            lambda body: body["tree"]["name"] == "MAT1" and body["total_nodes"] == 1,
        ),
        (
            "/api/summary",
            {"batch_id": "B1"},
            "summary",
            lambda body: body["batch_id"] == "B1",
        ),
        (
            "/api/batch-details",
            {"material_id": "MAT1", "batch_id": "B1"},
            "batch_details",
            lambda body: body["summary"]["batch_id"] == "B1",
        ),
        (
            "/api/impact",
            {"batch_id": "B1"},
            "impact",
            lambda body: body["downstream"] == [],
        ),
    ]

    for path, payload, source_key, predicate in cases:
        response = client.post(path, headers={"x-forwarded-access-token": "token"}, json=payload)
        assert response.status_code == 200, response.text
        body = response.json()
        assert predicate(body)
        if assert_response is not None:
            assert_response(path, body)
        assert freshness_calls[-1]["request_path"] == path
        assert freshness_calls[-1]["source_views"] == CORE_TRACE_FRESHNESS_SOURCES[source_key]
