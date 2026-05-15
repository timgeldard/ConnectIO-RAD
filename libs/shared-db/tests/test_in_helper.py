"""Tests for build_in_params and the run_sql_in query executor."""

import asyncio
import pytest

from shared_db import build_in_params, run_sql_in


# ---------------------------------------------------------------------------
# build_in_params — parameter builder
# ---------------------------------------------------------------------------


def test_build_in_params_strings():
    frag, params = build_in_params(["PL01", "PL02"])
    assert frag == ":p0, :p1"
    assert params[0] == {"name": "p0", "value": "PL01", "type": "STRING"}
    assert params[1] == {"name": "p1", "value": "PL02", "type": "STRING"}


def test_build_in_params_integers():
    frag, params = build_in_params([1, 2, 3], prefix="id")
    assert frag == ":id0, :id1, :id2"
    assert all(p["type"] == "INT" for p in params)


def test_build_in_params_empty_returns_null():
    frag, params = build_in_params([])
    assert frag == "NULL"
    assert params == []


def test_build_in_params_mixed_types():
    frag, params = build_in_params(["A", 42, True])
    types = [p["type"] for p in params]
    assert types == ["STRING", "INT", "BOOLEAN"]


# ---------------------------------------------------------------------------
# run_sql_in — full query executor
# ---------------------------------------------------------------------------


def _make_executor(captured: list):
    """Return a mock run_sql that records statements and returns empty rows."""

    async def _run(token, statement, params=None, **kwargs):
        captured.append((statement, params))
        return []

    return _run


def test_run_sql_in_renders_placeholders_into_statement(monkeypatch):
    captured = []

    async def mock_run_sql_async(token, statement, params=None, **kwargs):
        captured.append((statement, params))
        return []

    import shared_db.core as core_mod
    monkeypatch.setattr(core_mod, "run_sql_async", mock_run_sql_async)

    asyncio.run(
        run_sql_in(
            "token",
            "SELECT * FROM plants WHERE plant_id IN ({placeholders})",
            in_param="plant_id",
            values=["PL01", "PL02"],
        )
    )

    assert len(captured) == 1
    stmt, params = captured[0]
    assert ":plant_id0" in stmt
    assert ":plant_id1" in stmt
    assert params[0]["name"] == "plant_id0"
    assert params[1]["name"] == "plant_id1"


def test_run_sql_in_supports_table_ref_kwargs(monkeypatch):
    captured = []

    async def mock_run_sql_async(token, statement, params=None, **kwargs):
        captured.append(statement)
        return []

    import shared_db.core as core_mod
    monkeypatch.setattr(core_mod, "run_sql_async", mock_run_sql_async)

    asyncio.run(
        run_sql_in(
            "token",
            "SELECT * FROM {plant_table} WHERE plant_id IN ({placeholders})",
            in_param="plant_id",
            values=["PL01"],
            plant_table="`cat`.`gold`.`gold_plant`",
        )
    )

    assert "`cat`.`gold`.`gold_plant`" in captured[0]


def test_run_sql_in_rejects_empty_values():
    with pytest.raises(ValueError, match="must not be empty"):
        asyncio.run(
            run_sql_in(
                "token",
                "SELECT * FROM t WHERE id IN ({placeholders})",
                in_param="id",
                values=[],
            )
        )


def test_run_sql_in_rejects_oversize_list():
    with pytest.raises(ValueError, match="too long"):
        asyncio.run(
            run_sql_in(
                "token",
                "SELECT * FROM t WHERE id IN ({placeholders})",
                in_param="id",
                values=list(range(1001)),
            )
        )


def test_run_sql_in_max_boundary_passes(monkeypatch):
    async def mock_run_sql_async(token, statement, params=None, **kwargs):
        return []

    import shared_db.core as core_mod
    monkeypatch.setattr(core_mod, "run_sql_async", mock_run_sql_async)

    result = asyncio.run(
        run_sql_in(
            "token",
            "SELECT * FROM t WHERE id IN ({placeholders})",
            in_param="id",
            values=list(range(1000)),
        )
    )
    assert result == []
