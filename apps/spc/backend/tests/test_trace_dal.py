from unittest.mock import AsyncMock
from shared_domain import test_data
import spc_backend.dal.trace_dal as trace_dal

def test_build_tree_breaks_cycles():
    mat1 = test_data.material_id()
    b1 = test_data.batch_id()
    mat2 = test_data.material_id()
    b2 = test_data.batch_id()
    rows = [
        {
            "material_id": mat1,
            "batch_id": b1,
            "parent_material_id": None,
            "parent_batch_id": None,
            "depth": 0,
            "release_status": "Released",
            "plant_name": "Plant A",
        },
        {
            "material_id": mat2,
            "batch_id": b2,
            "parent_material_id": mat1,
            "parent_batch_id": b1,
            "depth": 1,
            "release_status": "Released",
            "plant_name": "Plant A",
        },
        {
            "material_id": mat1,
            "batch_id": b1,
            "parent_material_id": mat2,
            "parent_batch_id": b2,
            "depth": 2,
            "release_status": "Released",
            "plant_name": "Plant A",
        },
    ]

    tree = trace_dal._build_tree(rows)
    assert tree["name"] == mat1
    assert len(tree["children"]) == 1
    assert tree["children"][0]["name"] == mat2
    assert tree["children"][0]["children"] == []

def test_build_tree_various_statuses():
    m1, m2, m3, m4 = [test_data.material_id() for _ in range(4)]
    b1, b2, b3, b4 = [test_data.batch_id() for _ in range(4)]
    rows = [
        {"material_id": m1, "batch_id": b1, "release_status": "Released", "depth": 0},
        {"material_id": m2, "batch_id": b2, "release_status": "Blocked", "depth": 0},
        {"material_id": m3, "batch_id": b3, "release_status": "QI Hold", "depth": 0},
        {"material_id": m4, "batch_id": b4, "release_status": "Unknown", "depth": 0},
    ]
    # Check color/tier for each
    node1 = trace_dal._build_tree([rows[0]])
    assert node1["riskTier"] == "Pass"
    node2 = trace_dal._build_tree([rows[1]])
    assert node2["riskTier"] == "Critical"
    node3 = trace_dal._build_tree([rows[2]])
    assert node3["riskTier"] == "Warning"
    node4 = trace_dal._build_tree([rows[3]])
    assert node4["riskTier"] == "Unknown"

def test_build_tree_lowest_depth_wins():
    m1 = test_data.material_id()
    b1 = test_data.batch_id()
    rows = [
        {"material_id": m1, "batch_id": b1, "release_status": "Released", "depth": 2},
        {"material_id": m1, "batch_id": b1, "release_status": "Released", "depth": 0},
    ]
    tree = trace_dal._build_tree(rows)
    assert tree["name"] == m1
    assert tree["attributes"]["Depth"] == 0

def test_build_tree_shared_node_deduplication():
    m1, m2, m3, m4 = [test_data.material_id() for _ in range(4)]
    b1, b2, b3, b4 = [test_data.batch_id() for _ in range(4)]
    rows = [
        {"material_id": m1, "batch_id": b1, "release_status": "Released", "depth": 0},
        {"material_id": m2, "batch_id": b2, "parent_material_id": m1, "parent_batch_id": b1, "release_status": "Released", "depth": 1},
        {"material_id": m3, "batch_id": b3, "parent_material_id": m1, "parent_batch_id": b1, "release_status": "Released", "depth": 1},
        {"material_id": m4, "batch_id": b4, "parent_material_id": m2, "parent_batch_id": b2, "release_status": "Released", "depth": 2},
        {"material_id": m4, "batch_id": b4, "parent_material_id": m3, "parent_batch_id": b3, "release_status": "Released", "depth": 2},
    ]
    tree = trace_dal._build_tree(rows)
    target_m2 = next(c for c in tree["children"] if c["name"] == m2)
    target_m3 = next(c for c in tree["children"] if c["name"] == m3)
    assert len(target_m2["children"]) == 1
    assert len(target_m3["children"]) == 1
    assert target_m2["children"][0] == target_m3["children"][0]

async def test_fetch_trace_tree(monkeypatch):
    mat1 = test_data.material_id()
    b1 = test_data.batch_id()
    mock_run = AsyncMock(return_value=[{"material_id": mat1, "batch_id": b1}])
    monkeypatch.setattr(trace_dal, "run_sql_async", mock_run)
    
    res = await trace_dal.fetch_trace_tree("token", mat1, b1)
    assert res[0]["material_id"] == mat1
    assert mock_run.called

async def test_fetch_summary(monkeypatch):
    b1 = test_data.batch_id()
    b2 = test_data.batch_id()
    mock_run = AsyncMock(return_value=[{"total_produced": 100}])
    monkeypatch.setattr(trace_dal, "run_sql_async", mock_run)
    
    res = await trace_dal.fetch_summary("token", b1)
    assert res["total_produced"] == 100
    
    mock_run.return_value = []
    res = await trace_dal.fetch_summary("token", b2)
    assert res is None

async def test_fetch_batch_details(monkeypatch):
    mat1 = test_data.material_id()
    b1 = test_data.batch_id()
    mock_run = AsyncMock(return_value=[{"id": 1}])
    monkeypatch.setattr(trace_dal, "run_sql_async", mock_run)
    
    res = await trace_dal.fetch_batch_details("token", mat1, b1)
    assert res["summary"]["id"] == 1
    assert len(res["coa_results"]) == 1

async def test_fetch_impact(monkeypatch):
    b1 = test_data.batch_id()
    mock_run = AsyncMock(return_value=[{"customer_name": "Cust"}])
    monkeypatch.setattr(trace_dal, "run_sql_async", mock_run)
    
    res = await trace_dal.fetch_impact("token", b1)
    assert res["customers"][0]["customer_name"] == "Cust"
