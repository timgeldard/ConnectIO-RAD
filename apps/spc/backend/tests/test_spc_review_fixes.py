import asyncio

from fastapi import HTTPException
from pydantic import ValidationError
from starlette.requests import Request
from shared_manufacturing import test_data

from spc_backend.process_control.dal import analysis as spc_analysis_dal
from spc_backend.process_control.dal import charts as spc_charts_dal
from spc_backend.process_control.dal import metadata as spc_metadata_dal
from spc_backend.process_control.domain.capability import infer_spec_type
import spc_backend.chart_config.router as exclusions
import spc_backend.chart_config.dal.exclusions as exclusions_dal
from shared_db import utils as spc_common
from spc_backend.schemas.spc_schemas import ProcessFlowRequest


def test_fetch_characteristics_applies_plant_filter(monkeypatch):
    calls = []
    mat_id = test_data.material_id()
    plant = test_data.PLANTS[0]

    async def fake_run_sql_async(_token, query, params=None, **_kwargs):
        calls.append((query, params or []))
        return []

    monkeypatch.setattr(spc_metadata_dal, "run_sql_async", fake_run_sql_async)

    characteristics, attr_characteristics = asyncio.run(
        spc_metadata_dal.fetch_characteristics("token", mat_id, plant)
    )

    assert characteristics == []
    assert attr_characteristics == []
    query, params = calls[0]
    assert "plant_id = :plant_id" in query
    assert any(param["name"] == "plant_id" and param["value"] == plant for param in params)


def test_fetch_process_flow_aggregates_multi_plant_rows(monkeypatch):
    calls = []
    mat_root = test_data.material_id()
    mat_child = test_data.material_id()

    async def fake_run_sql_async(_token, query, _params=None, **_kwargs):
        calls.append((query, _params or []))
        if "SELECT DISTINCT" in query and "AS source" in query:
            return [{"source": mat_root, "target": mat_child}]
        return [
            {
                "material_id": mat_root,
                "material_name": "Root Material",
                "plant_name": None,
                "total_batches": 7,
                "rejected_batches": 1,
                "mic_count": 3,
            },
            {
                "material_id": mat_child,
                "material_name": "Child Material",
                "plant_name": None,
                "total_batches": 4,
                "rejected_batches": 0,
                "mic_count": 2,
            },
        ]

    monkeypatch.setattr(spc_analysis_dal, "run_sql_async", fake_run_sql_async)

    result = asyncio.run(
        spc_analysis_dal.fetch_process_flow("token", mat_root, None, None, 8, 6)
    )

    root = next(node for node in result["nodes"] if node["material_id"] == mat_root)
    assert root["total_batches"] == 7
    assert root["rejected_batches"] == 1
    assert root["plant_name"] is None
    assert result["upstream_depth"] == 8
    assert result["downstream_depth"] == 6
    edge_query, edge_params = calls[0]
    assert "spc_lineage_graph_mv" in edge_query
    assert "u.depth < :upstream_depth" in edge_query
    assert "d.depth < :downstream_depth" in edge_query
    assert any(param["name"] == "upstream_depth" and param["value"] == "8" for param in edge_params)
    assert any(param["name"] == "downstream_depth" and param["value"] == "6" for param in edge_params)


def test_handle_sql_error_masks_internal_details():
    try:
        spc_common.handle_sql_error(RuntimeError("Databricks exploded with secret SQL details"))
    except HTTPException as exc:
        assert exc.status_code == 500
        assert "Internal server error; reference id:" in exc.detail
        assert "secret SQL details" not in exc.detail
    else:  # pragma: no cover
        raise AssertionError("Expected HTTPException")


def test_apply_chart_row_formatting_raises_on_bad_numeric_value():
    b_id = test_data.batch_id()
    rows = [
        {
            "batch_id": b_id,
            "cursor_sample_id": "SAMPLE-7",
            "value": "not-a-number",
            "nominal": "10.0",
            "tolerance": "1.0",
            "lsl": None,
            "usl": None,
            "sample_seq": "1",
            "attribut": "",
        }
    ]

    try:
        spc_charts_dal._apply_chart_row_formatting(rows)
    except ValueError as exc:
        message = str(exc)
        assert "field 'value'" in message
        assert f"batch_id='{b_id}'" in message
        assert "'not-a-number'" in message
    else:  # pragma: no cover
        raise AssertionError("Expected ValueError")


def _base_chart_row(**overrides) -> dict:
    """Minimal valid chart row for USL/LSL derivation tests."""
    row = {
        "batch_id": "B-1",
        "cursor_sample_id": "S-1",
        "value": "10.0",
        "nominal": "5.0",
        "tolerance": "0.5",
        "lsl": None,
        "usl": None,
        "sample_seq": "1",
        "attribut": "",
    }
    row.update(overrides)
    return row


def test_apply_chart_row_formatting_derives_both_sides_when_both_missing():
    """When usl and lsl are both None, derive both from nominal ± tolerance."""
    rows = [_base_chart_row(lsl=None, usl=None)]
    spc_charts_dal._apply_chart_row_formatting(rows)
    assert rows[0]["usl"] == 5.5
    assert rows[0]["lsl"] == 4.5


def test_apply_chart_row_formatting_preserves_supplied_usl_when_lsl_missing():
    """A supplied USL must NOT be overwritten when only LSL is missing.

    Regression for the asymmetric-spec bug surfaced in the PR-51 review:
    one-sided specs (USL or LSL alone) emitted by the view were being
    silently replaced by ``nominal ± tolerance``.
    """
    rows = [_base_chart_row(usl="10.0", lsl=None)]
    spc_charts_dal._apply_chart_row_formatting(rows)
    assert rows[0]["usl"] == 10.0  # preserved
    assert rows[0]["lsl"] == 4.5   # derived


def test_apply_chart_row_formatting_preserves_supplied_lsl_when_usl_missing():
    """A supplied LSL must NOT be overwritten when only USL is missing."""
    rows = [_base_chart_row(usl=None, lsl="2.0")]
    spc_charts_dal._apply_chart_row_formatting(rows)
    assert rows[0]["lsl"] == 2.0   # preserved
    assert rows[0]["usl"] == 5.5   # derived


def test_apply_chart_row_formatting_leaves_both_none_when_nominal_or_tol_missing():
    """If nominal or tolerance is None, USL/LSL stay None — no fabricated bounds."""
    rows = [_base_chart_row(nominal=None, tolerance=None)]
    spc_charts_dal._apply_chart_row_formatting(rows)
    assert rows[0]["usl"] is None
    assert rows[0]["lsl"] is None


def test_get_exclusions_query_rejects_invalid_stratify_by():
    mat_id = test_data.material_id()
    mic = test_data.mic_id()
    try:
        exclusions.GetExclusionsQuery(
            material_id=mat_id,
            mic_id=mic,
            stratify_by="bad_column",
        )
    except ValidationError as exc:
        assert "stratify_by must be one of" in str(exc)
    else:  # pragma: no cover
        raise AssertionError("Expected ValidationError")


def test_get_exclusions_includes_legacy_plant_fallback(monkeypatch):
    calls = []
    mat_id = test_data.material_id()
    mic = test_data.mic_id()
    plant = test_data.PLANTS[0]

    async def fake_run_sql_async(_token, query, params=None, **_kwargs):
        calls.append((query, params or []))
        return []

    monkeypatch.setattr(exclusions_dal, "run_sql_async", fake_run_sql_async)
    monkeypatch.setattr(exclusions, "check_warehouse_config", lambda: None)

    request = Request({"type": "http", "method": "GET", "headers": []})
    query = exclusions.GetExclusionsQuery(
        material_id=mat_id,
        mic_id=mic,
        plant_id=plant,
        stratify_all=True,
        stratify_by="plant_id",
    )

    from shared_auth import UserIdentity
    result = asyncio.run(
        exclusions.fetch_exclusions(
            request=request,
            query=query,
            user=UserIdentity(user_id="test", raw_token="token")
        )
    )
    assert result == {"exclusions": None}
    sql, params = calls[0]
    assert "AND stratify_by IS NULL" in sql
    assert "AND :stratify_by = 'plant_id'" in sql
    assert any(param["name"] == "stratify_by" and param["value"] == "plant_id" for param in params)


def test_fetch_actor_metadata_returns_sql_runtime_row(monkeypatch):
    """Actor metadata DAL returns the SQL runtime identity row."""
    async def fake_run_sql_async(token, query, params=None, **kwargs):
        assert token == "token"
        assert "CURRENT_USER()" in query
        assert params is None
        assert kwargs["endpoint_hint"] == "spc.exclusions.actor-metadata"
        return [{"user_id": "alice@example.com", "event_ts": "2026-01-01T00:00:00"}]

    monkeypatch.setattr(exclusions_dal, "run_sql_async", fake_run_sql_async)

    result = asyncio.run(exclusions_dal.fetch_actor_metadata("token"))

    assert result == {"user_id": "alice@example.com", "event_ts": "2026-01-01T00:00:00"}


def test_fetch_actor_metadata_defaults_when_runtime_returns_no_rows(monkeypatch):
    """Actor metadata DAL returns null fields when SQL returns no rows."""
    async def fake_run_sql_async(_token, _query, params=None, **_kwargs):
        assert params is None
        return []

    monkeypatch.setattr(exclusions_dal, "run_sql_async", fake_run_sql_async)

    result = asyncio.run(exclusions_dal.fetch_actor_metadata("token"))

    assert result == {"user_id": None, "event_ts": None}


def test_infer_spec_type_distinguishes_unspecified_and_asymmetric_specs():
    assert infer_spec_type(None, None) == "unspecified"
    assert infer_spec_type(13.0, 7.0, 10.0) == "bilateral_symmetric"
    assert infer_spec_type(14.0, 7.0, 10.0) == "bilateral_asymmetric"
    assert infer_spec_type(12.0, None, 10.0) == "unilateral_upper"
    assert infer_spec_type(None, 8.0, 10.0) == "unilateral_lower"


def test_process_flow_request_allows_configurable_lineage_depth():
    mat_id = test_data.material_id()
    request = ProcessFlowRequest(material_id=mat_id, upstream_depth=10, downstream_depth=9)

    assert request.upstream_depth == 10
    assert request.downstream_depth == 9


def test_process_flow_request_rejects_out_of_range_lineage_depth():
    mat_id = test_data.material_id()
    try:
        ProcessFlowRequest(material_id=mat_id, upstream_depth=0)
    except ValidationError as exc:
        assert "lineage depth must be between 1 and 10" in str(exc)
    else:  # pragma: no cover
        raise AssertionError("Expected ValidationError")


def test_fetch_compare_scorecard_single_grouped_query(monkeypatch):
    # New implementation issues one grouped query to spc_quality_metrics (plus a
    # parallel names query to gold_material). fake_run_sql_async returns full rows
    # that satisfy both call sites.
    calls: list[str] = []
    mat1 = test_data.material_id()
    mat2 = test_data.material_id()
    mic = test_data.mic_id()

    async def fake_run_sql_async(_token, _query, _params=None, **_kwargs):
        calls.append(_query)
        return [
            {"material_id": mat1, "material_name": "Material 1",
             "mic_id": mic, "mic_name": "MIC A", "batch_count": 4, "ppk": 1.2, "ooc_rate": 0.05},
            {"material_id": mat2, "material_name": "Material 2",
             "mic_id": mic, "mic_name": "MIC A", "batch_count": 5, "ppk": 1.1, "ooc_rate": 0.03},
        ]

    monkeypatch.setattr(spc_analysis_dal, "run_sql_async", fake_run_sql_async)

    result = asyncio.run(
        spc_analysis_dal.fetch_compare_scorecard("token", [mat1, mat2], None, None, None)
    )

    # Exactly 2 SQL calls (grouped scorecard + names), not N per-material calls.
    assert len(calls) == 2
    assert [entry["material_id"] for entry in result["materials"]] == [mat1, mat2]
    assert result["materials"][0]["material_name"] == "Material 1"
    assert result["materials"][0]["scorecard"][0]["mic_id"] == mic
    assert result["common_mics"] == [{"mic_id": mic, "mic_name": "MIC A"}]
