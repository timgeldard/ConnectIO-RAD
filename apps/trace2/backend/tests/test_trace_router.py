from fastapi.testclient import TestClient
from shared_auth import UserIdentity, require_proxy_user
from shared_trace.conformance import (
    assert_core_trace_route_contract,
    install_core_trace_route_stubs,
)

from trace2_backend.main import app
import trace2_backend.routers.trace as trace_router
import trace2_backend.batch_trace.router
import trace2_backend.lineage_analysis.router
import trace2_backend.quality_record.router
import trace2_backend.batch_trace.application.queries
import trace2_backend.lineage_analysis.application.queries
import trace2_backend.quality_record.application.queries

client = TestClient(app)


def test_shared_core_trace_route_contract(monkeypatch):
    # Patch check_warehouse_config everywhere it's used in routers
    monkeypatch.setattr(trace2_backend.batch_trace.router, "check_warehouse_config", lambda: None)
    monkeypatch.setattr(trace2_backend.lineage_analysis.router, "check_warehouse_config", lambda: None)
    monkeypatch.setattr(trace2_backend.quality_record.router, "check_warehouse_config", lambda: None)

    # stubs for core functions in trace_router (the shim)
    # This installs mocks on trace_router module
    freshness_calls = install_core_trace_route_stubs(monkeypatch, trace_router)
    
    # Now we need to make sure the CONTEXT routers/application services use these same mocks
    # because TestClient(app) calls the context routers registered in main.py
    
    # Redirect application service calls to the mocks installed by install_core_trace_route_stubs
    monkeypatch.setattr(trace2_backend.batch_trace.application.queries, "fetch_trace_tree", trace_router.fetch_trace_tree)
    monkeypatch.setattr(trace2_backend.batch_trace.application.queries, "fetch_summary", trace_router.fetch_summary)
    monkeypatch.setattr(trace2_backend.batch_trace.application.queries, "fetch_batch_details", trace_router.fetch_batch_details)
    monkeypatch.setattr(trace2_backend.batch_trace.application.queries, "fetch_impact", trace_router.fetch_impact)
    monkeypatch.setattr(trace2_backend.batch_trace.application.queries, "fetch_batch_header", trace_router.fetch_batch_header)
    monkeypatch.setattr(trace2_backend.batch_trace.application.queries, "attach_payload_freshness", trace_router.attach_payload_freshness)
    monkeypatch.setattr(trace2_backend.batch_trace.application.queries, "build_trace_tree", lambda rows: trace_router._build_tree(rows))

    monkeypatch.setattr(trace2_backend.lineage_analysis.application.queries, "fetch_recall_readiness", trace_router.fetch_recall_readiness)
    monkeypatch.setattr(trace2_backend.lineage_analysis.application.queries, "fetch_bottom_up", trace_router.fetch_bottom_up)
    monkeypatch.setattr(trace2_backend.lineage_analysis.application.queries, "fetch_top_down", trace_router.fetch_top_down)
    monkeypatch.setattr(trace2_backend.lineage_analysis.application.queries, "fetch_supplier_risk", trace_router.fetch_supplier_risk)
    monkeypatch.setattr(trace2_backend.lineage_analysis.application.queries, "attach_payload_freshness", trace_router.attach_payload_freshness)

    monkeypatch.setattr(trace2_backend.quality_record.application.queries, "fetch_coa", trace_router.fetch_coa)
    monkeypatch.setattr(trace2_backend.quality_record.application.queries, "fetch_mass_balance", trace_router.fetch_mass_balance)
    monkeypatch.setattr(trace2_backend.quality_record.application.queries, "fetch_quality", trace_router.fetch_quality)
    monkeypatch.setattr(trace2_backend.quality_record.application.queries, "fetch_production_history", trace_router.fetch_production_history)
    monkeypatch.setattr(trace2_backend.quality_record.application.queries, "fetch_batch_compare", trace_router.fetch_batch_compare)
    monkeypatch.setattr(trace2_backend.quality_record.application.queries, "attach_payload_freshness", trace_router.attach_payload_freshness)

    app.dependency_overrides[require_proxy_user] = lambda: UserIdentity(user_id="test-user", raw_token="token")

    try:
        assert_core_trace_route_contract(client, freshness_calls)
    finally:
        app.dependency_overrides.clear()
