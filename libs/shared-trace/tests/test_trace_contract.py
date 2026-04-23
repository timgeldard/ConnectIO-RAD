import pytest

from shared_trace.freshness_sources import CORE_TRACE_FRESHNESS_SOURCES
from shared_trace.schemas import BatchDetailsRequest, SummaryRequest, TraceRequest
from shared_trace.tree import build_trace_tree


def test_trace_request_models_trim_and_validate_identifiers():
    request = TraceRequest(material_id=" MAT1 ", batch_id=" B1 ")
    assert request.material_id == "MAT1"
    assert request.batch_id == "B1"

    with pytest.raises(ValueError, match="material_id must not be blank"):
        BatchDetailsRequest(material_id="  ", batch_id="B1")

    with pytest.raises(ValueError, match="batch_id must be at most 80 characters"):
        SummaryRequest(batch_id="x" * 81)


def test_build_trace_tree_maps_status_and_prevents_cycles():
    rows = [
        {
            "material_id": "ROOT",
            "batch_id": "B0",
            "parent_material_id": None,
            "parent_batch_id": None,
            "depth": 0,
            "release_status": "Released",
            "plant_name": "Plant 1",
        },
        {
            "material_id": "CHILD",
            "batch_id": "B1",
            "parent_material_id": "ROOT",
            "parent_batch_id": "B0",
            "depth": 1,
            "release_status": "QI Hold",
            "plant_name": "Plant 2",
        },
        {
            "material_id": "ROOT",
            "batch_id": "B0",
            "parent_material_id": "CHILD",
            "parent_batch_id": "B1",
            "depth": 2,
            "release_status": "Blocked",
            "plant_name": "Plant 1",
        },
    ]

    tree = build_trace_tree(rows)

    assert tree is not None
    assert tree["name"] == "ROOT"
    assert tree["riskTier"] == "Pass"
    assert tree["children"][0]["name"] == "CHILD"
    assert tree["children"][0]["riskTier"] == "Warning"
    assert tree["children"][0]["children"] == []


def test_core_trace_freshness_sources_are_contract_tuples():
    assert CORE_TRACE_FRESHNESS_SOURCES["trace"][0] == "gold_batch_lineage"
    assert "gold_batch_mass_balance_v" in CORE_TRACE_FRESHNESS_SOURCES["summary"]
