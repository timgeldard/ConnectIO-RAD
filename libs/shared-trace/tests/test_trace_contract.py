import pytest

from shared_trace.freshness_sources import CORE_TRACE_FRESHNESS_SOURCES
from shared_trace.dal import TraceCoreDal
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


def test_build_trace_tree_preserves_multiple_roots():
    rows = [
        {
            "material_id": "ROOT-A",
            "batch_id": "B0",
            "parent_material_id": None,
            "parent_batch_id": None,
            "depth": 0,
            "release_status": "Released",
        },
        {
            "material_id": "ROOT-B",
            "batch_id": "B1",
            "parent_material_id": None,
            "parent_batch_id": None,
            "depth": 0,
            "release_status": "Blocked",
        },
        {
            "material_id": "CHILD-B",
            "batch_id": "B2",
            "parent_material_id": "ROOT-B",
            "parent_batch_id": "B1",
            "depth": 1,
            "release_status": "QI Hold",
        },
    ]

    tree = build_trace_tree(rows)

    assert tree is not None
    assert tree["name"] == "Trace roots"
    assert tree["attributes"]["Root Count"] == 2
    assert [child["name"] for child in tree["children"]] == ["ROOT-A", "ROOT-B"]
    assert tree["children"][1]["children"][0]["name"] == "CHILD-B"


def test_core_trace_freshness_sources_are_contract_tuples():
    assert CORE_TRACE_FRESHNESS_SOURCES["trace"][0] == "gold_batch_lineage"
    assert "gold_batch_mass_balance_v" in CORE_TRACE_FRESHNESS_SOURCES["summary"]


@pytest.mark.anyio
async def test_trace_core_dal_uses_injected_sql_helpers():
    calls = []

    async def run_sql_async(token, statement, params=None):
        calls.append((token, statement, params or []))
        return [{"material_id": "MAT1", "batch_id": "B1"}]

    dal = TraceCoreDal(
        run_sql_async=run_sql_async,
        tbl=lambda name: f"`catalog`.`schema`.`{name}`",
        sql_param=lambda name, value: {"name": name, "value": value, "type": "STRING"},
    )

    rows = await dal.fetch_trace_tree("token", "MAT1", "B1", 3)

    assert rows == [{"material_id": "MAT1", "batch_id": "B1"}]
    assert "`catalog`.`schema`.`gold_batch_lineage`" in calls[0][1]
    assert calls[0][2] == [
        {"name": "mat", "value": "MAT1", "type": "STRING"},
        {"name": "bat", "value": "B1", "type": "STRING"},
        {"name": "max_levels", "value": 3, "type": "STRING"},
    ]


@pytest.mark.anyio
async def test_fetch_summary_uses_balance_qty():
    calls = []
    async def run_sql_async(_t, statement, _p=None):
        calls.append(statement)
        return []

    dal = TraceCoreDal(run_sql_async=run_sql_async, tbl=lambda n: n, sql_param=lambda n, v: {})
    await dal.fetch_summary("token", "BATCH1")
    
    sql = calls[0]
    assert "BALANCE_QTY" in sql
    assert "MOVEMENT_CATEGORY = 'Production'" in sql
    assert "ABS_QUANTITY" not in sql


@pytest.mark.anyio
async def test_fetch_mass_balance_events_uses_balance_qty():
    calls = []
    async def run_sql_async(_t, statement, _p=None):
        calls.append(statement)
        return []

    dal = TraceCoreDal(run_sql_async=run_sql_async, tbl=lambda n: n, sql_param=lambda n, v: {})
    await dal.fetch_mass_balance("token", "MAT1", "BATCH1")
    
    # 2nd call is events query
    sql = calls[1]
    assert "BALANCE_QTY AS delta" in sql
    assert "-ABS_QUANTITY" not in sql
