from fastapi.testclient import TestClient
from shared_trace.conformance import assert_core_trace_route_contract, install_core_trace_route_stubs

from backend.main import app
import backend.routers.trace as trace_router


client = TestClient(app)


def test_shared_core_trace_route_contract(monkeypatch):
    freshness_calls = install_core_trace_route_stubs(monkeypatch, trace_router)

    assert_core_trace_route_contract(client, freshness_calls)
