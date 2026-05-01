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

    async def attach_payload(payload: dict[str, Any], token: str, request_path: str, source_views: list[str], **_kwargs):
        freshness_calls.append(
            {
                "payload": payload,
                "token": token,
                "request_path": request_path,
                "source_views": tuple(source_views),
            }
        )
        return payload

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

    # Page endpoints
    page_stub = AsyncMock(return_value={"header": {"material_id": "MAT1", "batch_id": "B1"}})
    monkeypatch.setattr(trace_router_module, "fetch_coa", page_stub)
    monkeypatch.setattr(trace_router_module, "fetch_mass_balance", page_stub)
    monkeypatch.setattr(trace_router_module, "fetch_quality", page_stub)
    monkeypatch.setattr(trace_router_module, "fetch_production_history", page_stub)
    monkeypatch.setattr(trace_router_module, "fetch_batch_compare", page_stub)
    monkeypatch.setattr(trace_router_module, "fetch_bottom_up", page_stub)
    monkeypatch.setattr(trace_router_module, "fetch_top_down", page_stub)
    monkeypatch.setattr(trace_router_module, "fetch_supplier_risk", page_stub)
    monkeypatch.setattr(trace_router_module, "fetch_recall_readiness", page_stub)
    monkeypatch.setattr(trace_router_module, "fetch_batch_header", AsyncMock(return_value={"id": "B1"}))

    return freshness_calls


def assert_core_trace_route_contract(
    client: TestClient,
    freshness_calls: list[dict[str, Any]],
    *,
    assert_response: Callable[[str, dict[str, Any]], None] | None = None,
) -> None:
    page_req = {"material_id": "MAT1", "batch_id": "B1"}
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
        ("/api/coa", page_req, "coa", lambda b: b["header"]["material_id"] == "MAT1"),
        ("/api/mass-balance", page_req, "mass_balance", lambda b: b["header"]["material_id"] == "MAT1"),
        ("/api/quality", page_req, "quality", lambda b: b["header"]["material_id"] == "MAT1"),
        ("/api/production-history", page_req, "production_history", lambda b: b["header"]["material_id"] == "MAT1"),
        ("/api/batch-compare", page_req, "batch_compare", lambda b: b["header"]["material_id"] == "MAT1"),
        ("/api/bottom-up", page_req, "bottom_up", lambda b: b["header"]["material_id"] == "MAT1"),
        ("/api/top-down", page_req, "top_down", lambda b: b["header"]["material_id"] == "MAT1"),
        ("/api/supplier-risk", page_req, "supplier_risk", lambda b: b["header"]["material_id"] == "MAT1"),
        # recall-readiness has a slightly different freshness source key structure in the router but uses it.
        # We check freshness for it separately if needed or add to TRACE2_PAGE_FRESHNESS_SOURCES
    ]

    for path, payload, source_key, predicate in cases:
        response = client.post(path, headers={"x-forwarded-access-token": "token"}, json=payload)
        assert response.status_code == 200, f"Error at {path}: {response.text}"
        body = response.json()
        assert predicate(body), f"Predicate failed for {path}"
        if assert_response is not None:
            assert_response(path, body)

        from shared_trace.freshness_sources import (
            TRACE2_PAGE_FRESHNESS_SOURCES,
            CORE_TRACE_FRESHNESS_SOURCES,
        )

        expected_sources = CORE_TRACE_FRESHNESS_SOURCES.get(source_key)
        if expected_sources is None:
            expected_sources = TRACE2_PAGE_FRESHNESS_SOURCES.get(source_key)

        assert expected_sources is not None, f"No expected sources for {source_key}"
        assert freshness_calls[-1]["request_path"] == path
        assert freshness_calls[-1]["source_views"] == tuple(expected_sources)
