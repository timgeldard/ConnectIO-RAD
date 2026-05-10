import asyncio

from spc_backend.process_control.dal import analysis as spc_analysis_dal
from unittest.mock import AsyncMock
from shared_domain import test_data


def test_fetch_scorecard_queries_metric_view_and_preserves_capability_fields(monkeypatch):
    calls = []
    mic = test_data.mic_id()

    async def fake_run_sql_async(_token, query, params=None, **_kwargs):
        calls.append((query, params or []))
        return [
            {
                "mic_id": mic,
                "mic_name": "Viscosity",
                "batch_count": 5,
                "sample_count": 20,
                "mean_value": 10.0,
                "stddev_overall": 1.5,
                "min_value": 7.5,
                "max_value": 12.5,
                "nominal_target": 10.0,
                "lsl": 7.0,
                "usl": 13.0,
                "ooc_batches": 0,
                "accepted_batches": 5,
                "ooc_rate": 0.0,
                "sigma_within": 1.0,
                "pp": 0.667,
                "ppk": 0.667,
                "cp": 1.0,
                "cpk": 1.0,
                "z_score": 2.0,
                "dpmo": 308538,
                "distinct_spec_count": 1,
                "performance_capability_method": "parametric",
                "mean_out_of_spec_flag": 0,
            }
        ]

    monkeypatch.setattr(spc_analysis_dal, "run_sql_async", fake_run_sql_async)
    mat_id = test_data.material_id()

    rows = asyncio.run(spc_analysis_dal.fetch_scorecard("token", mat_id, None, None, None))

    query, _params = calls[0]
    assert "MEASURE(batch_count)" in query
    assert "spc_quality_metrics" in query
    assert rows[0]["spec_type"] == "bilateral_symmetric"
    assert rows[0]["mic_id"] == mic


def test_fetch_scorecard_marks_unspecified_specs(monkeypatch):
    mic = test_data.mic_id()

    async def fake_run_sql_async(_token, _query, _params=None, **_kwargs):
        return [
            {
                "mic_id": mic,
                "mic_name": "Density",
                "batch_count": 5,
                "sample_count": 20,
                "mean_value": 10.0,
                "stddev_overall": 1.5,
                "min_value": 7.5,
                "max_value": 12.5,
                "nominal_target": None,
                "lsl": None,
                "usl": None,
                "ooc_batches": 0,
                "accepted_batches": 5,
                "ooc_rate": 0.0,
                "sigma_within": None,
                "pp": None,
                "ppk": None,
                "cp": None,
                "cpk": None,
                "z_score": None,
                "dpmo": None,
                "distinct_spec_count": 0,
                "performance_capability_method": "unknown",
                "mean_out_of_spec_flag": 0,
            }
        ]

    monkeypatch.setattr(spc_analysis_dal, "run_sql_async", fake_run_sql_async)
    mat_id = test_data.material_id()

    rows = asyncio.run(spc_analysis_dal.fetch_scorecard("token", mat_id, None, None, None))

    assert rows[0]["spec_type"] == "unspecified"
    assert rows[0]["mic_id"] == mic


def test_fetch_scorecard_marks_out_of_spec_mean_distinctly(monkeypatch):
    mic = test_data.mic_id()

    async def fake_run_sql_async(_token, _query, _params=None, **_kwargs):
        return [
            {
                "mic_id": mic,
                "mic_name": "pH",
                "batch_count": 5,
                "sample_count": 20,
                "mean_value": 14.0,
                "stddev_overall": 1.0,
                "min_value": 12.0,
                "max_value": 16.0,
                "nominal_target": 10.0,
                "lsl": 8.0,
                "usl": 12.0,
                "ooc_batches": 4,
                "accepted_batches": 1,
                "ooc_rate": 0.8,
                "sigma_within": 1.0,
                "pp": -0.667,
                "ppk": -0.667,
                "cp": -0.667,
                "cpk": -0.667,
                "z_score": -2.0,
                "dpmo": 933193,
                "distinct_spec_count": 1,
                "performance_capability_method": "parametric",
                "mean_out_of_spec_flag": 1,
            }
        ]

    monkeypatch.setattr(spc_analysis_dal, "run_sql_async", fake_run_sql_async)
    mat_id = test_data.material_id()

    rows = asyncio.run(spc_analysis_dal.fetch_scorecard("token", mat_id, None, None, None))

    assert rows[0]["ppk"] < 0
    assert rows[0]["capability_status"] == "out_of_spec_mean"


def _stable_row(ooc_batches: int) -> dict:
    return {
        "mic_id": test_data.mic_id(),
        "mic_name": "Temperature",
        "batch_count": 10,
        "sample_count": 30,
        "mean_value": 50.0,
        "stddev_overall": 1.0,
        "min_value": 47.0,
        "max_value": 53.0,
        "nominal_target": 50.0,
        "lsl": 45.0,
        "usl": 55.0,
        "ooc_batches": ooc_batches,
        "accepted_batches": 10 - ooc_batches,
        "ooc_rate": ooc_batches / 10.0,
        "sigma_within": 1.0,
        "pp": 1.67,
        "ppk": 1.67,
        "cp": 1.67,
        "cpk": 1.67,
        "z_score": 5.0,
        "dpmo": 233,
        "distinct_spec_count": 1,
        "performance_capability_method": "parametric",
        "mean_out_of_spec_flag": 0,
    }


def test_fetch_scorecard_marks_stable_when_no_ooc_batches(monkeypatch):
    async def fake_run_sql_async(_token, _query, _params=None, **_kwargs):
        return [_stable_row(ooc_batches=0)]

    monkeypatch.setattr(spc_analysis_dal, "run_sql_async", fake_run_sql_async)
    rows = asyncio.run(spc_analysis_dal.fetch_scorecard("token", test_data.material_id(), None, None, None))

    assert rows[0]["is_stable"] is True
    assert rows[0]["stability_basis"] == "ooc_rate_proxy"


def test_fetch_scorecard_marks_unstable_when_any_ooc_batch(monkeypatch):
    async def fake_run_sql_async(_token, _query, _params=None, **_kwargs):
        # With default 0.01 threshold, 1/10 = 0.1 is unstable.
        return [_stable_row(ooc_batches=1)]

    monkeypatch.setattr(spc_analysis_dal, "run_sql_async", fake_run_sql_async)
    rows = asyncio.run(spc_analysis_dal.fetch_scorecard("token", test_data.material_id(), None, None, None))

    # One OOC batch out of 10 exceeds the 1% threshold (0.1 > 0.01).
    assert rows[0]["is_stable"] is False
    assert rows[0]["stability_basis"] == "ooc_rate_proxy"


async def test_fetch_process_flow(monkeypatch):
    calls = []
    mat_a = test_data.material_id()
    mat_b = test_data.material_id()

    async def fake_run_sql_async(_token, query, params=None, **kwargs):
        calls.append((query, params or []))
        if "spc_lineage_graph_mv" in query:
            return [{"source": mat_a, "target": mat_b}]
        return [{"material_id": mat_a, "total_batches": 10, "rejected_batches": 1, "mic_count": 5}]

    monkeypatch.setattr(spc_analysis_dal, "run_sql_async", fake_run_sql_async)
    res = await spc_analysis_dal.fetch_process_flow("token", mat_a, None, None)
    assert len(res["nodes"]) > 0
    assert len(res["edges"]) > 0


async def test_fetch_multivariate(monkeypatch):
    mat_id = test_data.material_id()
    batch_a = test_data.batch_id()
    mic_a = test_data.mic_id()
    mic_b = test_data.mic_id()

    async def fake_run_sql_async(_token, query, params=None, **kwargs):
        return [
            {"batch_id": batch_a, "batch_date": "2026-04-01", "mic_id": mic_a, "mic_name": "NM1", "avg_result": 10.0},
            {"batch_id": batch_a, "batch_date": "2026-04-01", "mic_id": mic_b, "mic_name": "NM2", "avg_result": 20.0},
        ]
    monkeypatch.setattr(spc_analysis_dal, "run_sql_async", fake_run_sql_async)
    monkeypatch.setattr(spc_analysis_dal, "compute_hotelling_t2", lambda rows, mic_ids: {"scores": []})
    res = await spc_analysis_dal.fetch_multivariate("token", mat_id, [mic_a, mic_b], None, None, None)
    assert "scores" in res
    assert res["material_id"] == mat_id


async def test_fetch_multivariate_too_large(monkeypatch):
    b_id = test_data.batch_id()
    async def fake_run_sql_async(_token, query, params=None, **kwargs):
        return [{"batch_id": b_id}] * (spc_analysis_dal._MULTIVARIATE_MAX_SOURCE_ROWS + 1)
    monkeypatch.setattr(spc_analysis_dal, "run_sql_async", fake_run_sql_async)
    import pytest
    mat_id = test_data.material_id()
    mic = test_data.mic_id()
    with pytest.raises(ValueError, match="too large for interactive analysis"):
        await spc_analysis_dal.fetch_multivariate("token", mat_id, [mic], None, None, None)


async def test_fetch_compare_scorecard(monkeypatch):
    mat_id = test_data.material_id()
    mic = test_data.mic_id()
    async def fake_run_sql_async(_token, query, params=None, **kwargs):
        if "spc_quality_metrics" in query:
            return [{"material_id": mat_id, "mic_id": mic, "mic_name": "Moisture", "ppk": 1.2, "batch_count": 5, "ooc_rate": 0.0}]
        return [{"material_id": mat_id, "material_name": "Name1"}]
    monkeypatch.setattr(spc_analysis_dal, "run_sql_async", fake_run_sql_async)
    res = await spc_analysis_dal.fetch_compare_scorecard("token", [mat_id], None, None, None)
    assert len(res["materials"]) == 1
    assert res["materials"][0]["material_name"] == "Name1"


async def test_save_msa_session(monkeypatch):
    mock_run = AsyncMock(return_value=[])
    monkeypatch.setattr(spc_analysis_dal, "run_sql_async", mock_run)
    mat_id = test_data.material_id()
    mic = test_data.mic_id()
    res = await spc_analysis_dal.save_msa_session("token", mat_id, mic, 2, 2, 2, 10.0, 0.1, 0.1, 5, "{}")
    assert res["saved"] is True
    assert "session_id" in res


async def test_fetch_correlation(monkeypatch):
    mat_id = test_data.material_id()
    async def fake_run_sql_async(_token, query, params=None, **kwargs):
        return [
            {"mic_a": "A", "mic_name_a": "NA", "mic_b": "B", "mic_name_b": "NB", "pearson_r": 0.8, "shared_batches": 10}
        ]
    monkeypatch.setattr(spc_analysis_dal, "run_sql_async", fake_run_sql_async)
    res = await spc_analysis_dal.fetch_correlation("token", mat_id, None, None, None, 5)
    assert len(res["pairs"]) == 1
    assert res["pair_count"] == 1
    assert len(res["mics"]) == 2


async def test_fetch_correlation_scatter(monkeypatch):
    mat_id = test_data.material_id()
    mic1 = test_data.mic_id()
    mic2 = test_data.mic_id()
    b_id = test_data.batch_id()
    async def fake_run_sql_async(_token, query, params=None, **kwargs):
        return [
            {"batch_id": b_id, "batch_date": "2026-04-01", "x": 10.0, "y": 20.0, "mic_a_name": "NX", "mic_b_name": "NY"}
        ]
    monkeypatch.setattr(spc_analysis_dal, "run_sql_async", fake_run_sql_async)
    res = await spc_analysis_dal.fetch_correlation_scatter("token", mat_id, mic1, mic2, None, None, None)
    assert len(res["points"]) == 1
    assert res["n"] == 1
    assert res["mic_a_name"] == "NX"
