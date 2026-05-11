import asyncio
from shared_manufacturing import test_data
from spc_backend.process_control.dal import metadata as spc_metadata_dal


def _characteristic_row(**overrides):
    mic = test_data.mic_id()
    base = {
        "mic_id": mic,
        "operation_id": "OP-1",
        "mic_name": "Viscosity",
        "mic_name_normalized": "VISCOSITY",
        "inspection_method": "GAUGE",
        "unified_mic_key": f"C351||VISCOSITY||NO_UNIT",
        "is_attribute": 0,
        "has_quantitative": 1,
        "batch_count": 10,
        "total_samples": 10,
    }
    base.update(overrides)
    return base


def _fake_runner(characteristics_rows, override_rows=None, attribute_rows=None):
    """Build a fake run_sql_async that returns characteristics for the main query
    and overrides for the config-table lookup. The lookup is identified by its
    FROM clause referencing spc_mic_chart_config."""

    async def _run(_token, query, _params=None, **_kwargs):
        if "spc_mic_chart_config" in query:
            return override_rows or []
        if "spc_attribute_quality_metrics" in query:
            return attribute_rows or []
        return characteristics_rows

    return _run


def test_fetch_characteristics_applies_heuristic_when_no_override(monkeypatch):
    rows = [_characteristic_row(total_samples=10, batch_count=10)]  # avg_spb=1.0 → imr
    monkeypatch.setattr(spc_metadata_dal, "run_sql_async", _fake_runner(rows, []))
    mat_id = test_data.material_id()
    plant = test_data.PLANTS[0]
    chars, _ = asyncio.run(spc_metadata_dal.fetch_characteristics("token", mat_id, plant))

    assert chars[0]["chart_type"] == "imr"
    assert chars[0]["chart_type_source"] == "heuristic"


def test_fetch_characteristics_prefers_override_over_heuristic(monkeypatch):
    mic = test_data.mic_id()
    rows = [_characteristic_row(mic_id=mic, total_samples=10, batch_count=10)]  # heuristic says imr
    mat_id = test_data.material_id()
    plant = test_data.PLANTS[0]
    overrides = [
        {"mic_id": mic, "chart_type": "xbar_s", "plant_id": plant, "material_id": mat_id},
    ]
    monkeypatch.setattr(spc_metadata_dal, "run_sql_async", _fake_runner(rows, overrides))
    chars, _ = asyncio.run(spc_metadata_dal.fetch_characteristics("token", mat_id, plant))

    assert chars[0]["chart_type"] == "xbar_s"
    assert chars[0]["chart_type_source"] == "override"


def test_fetch_characteristics_more_specific_override_wins(monkeypatch):
    mic = test_data.mic_id()
    rows = [_characteristic_row(mic_id=mic, total_samples=10, batch_count=10)]
    mat_id = test_data.material_id()
    plant = test_data.PLANTS[0]
    overrides = [
        # Global: would set to xbar_r
        {"mic_id": mic, "chart_type": "xbar_r", "plant_id": None, "material_id": None},
        # Material-specific: would set to imr
        {"mic_id": mic, "chart_type": "imr", "plant_id": None, "material_id": mat_id},
        # Plant+material-specific: should WIN with xbar_s
        {"mic_id": mic, "chart_type": "xbar_s", "plant_id": plant, "material_id": mat_id},
    ]
    monkeypatch.setattr(spc_metadata_dal, "run_sql_async", _fake_runner(rows, overrides))
    chars, _ = asyncio.run(spc_metadata_dal.fetch_characteristics("token", mat_id, plant))

    assert chars[0]["chart_type"] == "xbar_s"
    assert chars[0]["chart_type_source"] == "override"


def test_fetch_characteristics_ignores_unknown_override_chart_type(monkeypatch):
    rows = [_characteristic_row(total_samples=10, batch_count=10)]
    overrides = [
        {"mic_id": rows[0]["mic_id"], "chart_type": "not_a_real_chart", "plant_id": None, "material_id": None},
    ]
    monkeypatch.setattr(spc_metadata_dal, "run_sql_async", _fake_runner(rows, overrides))
    mat_id = test_data.material_id()
    plant = test_data.PLANTS[0]
    chars, _ = asyncio.run(spc_metadata_dal.fetch_characteristics("token", mat_id, plant))

    # Falls back to heuristic when override value is invalid.
    assert chars[0]["chart_type"] == "imr"
    assert chars[0]["chart_type_source"] == "heuristic"


def test_fetch_characteristics_swallows_missing_config_table(monkeypatch):
    """If migration 019 has not run yet, the lookup raises and we fall back."""
    rows = [_characteristic_row(total_samples=30, batch_count=10)]  # avg_spb=3.0 → xbar_r

    async def _run(_token, query, _params=None, **_kwargs):
        if "spc_mic_chart_config" in query:
            raise RuntimeError("Table not found: spc_mic_chart_config")
        if "spc_attribute_quality_metrics" in query:
            return []
        return rows

    monkeypatch.setattr(spc_metadata_dal, "run_sql_async", _run)
    mat_id = test_data.material_id()
    plant = test_data.PLANTS[0]
    chars, _ = asyncio.run(spc_metadata_dal.fetch_characteristics("token", mat_id, plant))

    assert chars[0]["chart_type"] == "xbar_r"
    assert chars[0]["chart_type_source"] == "heuristic"


def test_fetch_characteristics_override_applies_to_attribute_charts_too(monkeypatch):
    mic = test_data.mic_id()
    mat_id = test_data.material_id()
    attr_row = {
        "mic_id": mic,
        "operation_id": "OP-1",
        "mic_name": "Viscosity",
        "inspection_method": "GAUGE",
        "batch_count": 10,
        "total_inspected": 100,
        "total_nonconforming": 5,
        "p_bar": 0.05,
        "chart_type": "p_chart",
    }
    overrides = [
        {"mic_id": mic, "chart_type": "u_chart", "plant_id": None, "material_id": mat_id},
    ]
    monkeypatch.setattr(spc_metadata_dal, "run_sql_async", _fake_runner([], overrides, [attr_row]))
    _, attr_chars = asyncio.run(spc_metadata_dal.fetch_characteristics("token", mat_id, "PLANT-1"))

    assert attr_chars[0]["chart_type"] == "u_chart"
    assert attr_chars[0]["chart_type_source"] == "override"


def test_fetch_characteristics_attribute_override_rejects_variable_chart_type(monkeypatch):
    mic = test_data.mic_id()
    mat_id = test_data.material_id()
    attr_row = {
        "mic_id": mic,
        "operation_id": "OP-1",
        "mic_name": "Viscosity",
        "inspection_method": "GAUGE",
        "batch_count": 10,
        "total_inspected": 100,
        "total_nonconforming": 5,
        "p_bar": 0.05,
        "chart_type": "p_chart",
    }
    overrides = [
        # Nonsense: trying to force an attribute MIC to a variable chart.
        {"mic_id": mic, "chart_type": "imr", "plant_id": None, "material_id": mat_id},
    ]
    monkeypatch.setattr(spc_metadata_dal, "run_sql_async", _fake_runner([], overrides, [attr_row]))
    _, attr_chars = asyncio.run(spc_metadata_dal.fetch_characteristics("token", mat_id, "PLANT-1"))

    assert attr_chars[0]["chart_type"] == "p_chart"
    assert attr_chars[0]["chart_type_source"] == "default"


def test_fetch_attribute_characteristics_collapses_operations_in_sql(monkeypatch):
    """Regression: the attribute query must GROUP BY (mic_id, mic_name,
    inspection_method) — NOT by operation_id — and emit operation_id via
    `CASE WHEN COUNT(DISTINCT operation_id) = 1 THEN MAX(operation_id) END`.
    Without this, a single attribute MIC measured at N operations becomes N
    duplicate rows in the Characteristic dropdown."""
    captured: dict[str, object] = {}
    mat_id = test_data.material_id()
    plant = test_data.PLANTS[0]

    async def fake_run(_token, query, _params=None, **_kwargs):
        captured["query"] = query
        return []

    monkeypatch.setattr(spc_metadata_dal, "run_sql_async", fake_run)
    asyncio.run(spc_metadata_dal.fetch_attribute_characteristics("token", mat_id, plant))

    query = str(captured["query"])
    assert "COUNT(DISTINCT operation_id) = 1" in query
    assert "MAX(operation_id)" in query
    # GROUP BY must exclude operation_id (collapse is the whole point).
    group_by_section = query.split("GROUP BY", 1)[-1].split("HAVING", 1)[0]
    assert "operation_id" not in group_by_section
    assert "mic_id" in group_by_section
    assert "mic_name" in group_by_section
    assert "inspection_method" in group_by_section


def test_fetch_characteristics_routing_conflict_uses_mic_id_not_op(monkeypatch):
    """Because attribute rows can come back with operation_id=None (multi-op
    collapse), the variable/attribute overlap check keys on mic_id alone.
    Same mic_id as both attribute and quantitative → flag."""
    mic = test_data.mic_id()
    mat_id = test_data.material_id()
    plant = test_data.PLANTS[0]
    quant = [_characteristic_row(mic_id=mic, operation_id=None,
                                 total_samples=10, batch_count=10)]
    attr = [{
        "mic_id": mic,
        "operation_id": None,  # collapsed because it's used at multiple ops
        "mic_name": "Dual-typed MIC",
        "inspection_method": "GAUGE",
        "batch_count": 10,
        "total_inspected": 100,
        "total_nonconforming": 5,
        "p_bar": 0.05,
        "chart_type": "p_chart",
    }]
    monkeypatch.setattr(spc_metadata_dal, "run_sql_async",
                        _fake_runner(quant, [], attr))
    chars, attr_chars = asyncio.run(
        spc_metadata_dal.fetch_characteristics("token", mat_id, plant)
    )

    assert chars[0]["routing_conflict"] is True
    assert attr_chars[0]["routing_conflict"] is True


def test_fetch_characteristics_no_routing_conflict_when_mic_ids_differ(monkeypatch):
    mic_q = test_data.mic_id()
    mic_a = test_data.mic_id()
    mat_id = test_data.material_id()
    plant = test_data.PLANTS[0]
    quant = [_characteristic_row(mic_id=mic_q, total_samples=10, batch_count=10)]
    attr = [{
        "mic_id": mic_a,
        "operation_id": None,
        "mic_name": "Attribute only",
        "inspection_method": "GAUGE",
        "batch_count": 10,
        "total_inspected": 100,
        "total_nonconforming": 5,
        "p_bar": 0.05,
        "chart_type": "p_chart",
    }]
    monkeypatch.setattr(spc_metadata_dal, "run_sql_async",
                        _fake_runner(quant, [], attr))
    chars, attr_chars = asyncio.run(
        spc_metadata_dal.fetch_characteristics("token", mat_id, plant)
    )

    assert chars[0]["routing_conflict"] is False
    assert attr_chars[0]["routing_conflict"] is False
