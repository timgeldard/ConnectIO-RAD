"""
Unit tests for spc_backend/utils/db.py helper functions.

These tests cover SPC-specific database utility logic. Pure shared primitives
(sql_param, tbl, hostname, etc.) are tested in libs/shared-db and are not
re-tested here to reduce false coupling.
"""

import os
import asyncio
from unittest.mock import patch, AsyncMock

import spc_backend.utils.db as db_module
from shared_manufacturing import test_data


# Provide defaults so the module can be imported without env vars set
os.environ.setdefault("DATABRICKS_HOST", "https://adb-test.azuredatabricks.net/")
os.environ.setdefault("DATABRICKS_WAREHOUSE_HTTP_PATH", "/sql/1.0/warehouses/abc123")
os.environ.setdefault("TRACE_CATALOG", "test_catalog")
os.environ.setdefault("TRACE_SCHEMA", "test_schema")



class TestSqlCacheBehavior:
    def test_sql_cache_tier_classifies_known_hot_paths(self):
        assert db_module._sql_cache_tier("SELECT * FROM connected_plant_uat.gold.spc_characteristic_dim_mv") == "metadata"
        assert db_module._sql_cache_tier("SELECT * FROM connected_plant_uat.gold.spc_quality_metrics") == "scorecard"
        assert db_module._sql_cache_tier("SELECT * FROM connected_plant_uat.gold.spc_batch_dim_mv") == "metadata"

    def test_run_sql_async_clears_cache_after_write(self):
        db_module._clear_sql_cache()
        cache_key = db_module._sql_cache_key("token", "SELECT 1", None)
        with db_module._metadata_cache_lock:
            db_module._metadata_cache[cache_key] = [{"cached": "metadata"}]
        with db_module._scorecard_cache_lock:
            db_module._scorecard_cache[cache_key] = [{"cached": "scorecard"}]
        with db_module._chart_cache_lock:
            db_module._chart_cache[cache_key] = [{"cached": "chart"}]

        with patch("spc_backend.utils.db.run_sql", return_value=[]) as mocked_run_sql:
            asyncio.run(db_module.run_sql_async("token", "INSERT INTO t VALUES (1)", audit=False))

        mocked_run_sql.assert_called_once()
        with db_module._metadata_cache_lock:
            assert db_module._metadata_cache.get(cache_key) is None
        with db_module._scorecard_cache_lock:
            assert db_module._scorecard_cache.get(cache_key) is None
        with db_module._chart_cache_lock:
            assert db_module._chart_cache.get(cache_key) is None

    def test_run_sql_async_emits_query_audit_for_uncached_read(self):
        captured = []

        async def fake_insert_query_audit(token, *, endpoint, params, row_count, duration_ms):
            captured.append({
                "token": token,
                "endpoint": endpoint,
                "params": params,
                "row_count": row_count,
                "duration_ms": duration_ms,
            })

        async def exercise():
            db_module._clear_sql_cache()
            mat_id = test_data.material_id()
            with patch("spc_backend.utils.db.run_sql", return_value=[{"ok": 1}]), patch(
                "spc_backend.utils.db.insert_spc_query_audit",
                fake_insert_query_audit,
            ):
                rows = await db_module.run_sql_async(
                    "token",
                    "SELECT * FROM test_catalog.test_schema.spc_batch_dim_mv WHERE material_id = :material_id",
                    [db_module.sql_param("material_id", mat_id)],
                    endpoint_hint="spc.charts.chart-data",
                )
                await asyncio.sleep(0)
                return rows

        rows = asyncio.run(exercise())

        assert rows == [{"ok": 1}]
        assert captured
        assert captured[0]["endpoint"] == "spc.charts.chart-data"
        assert captured[0]["row_count"] == 1

    def test_run_sql_async_skips_query_audit_for_query_audit_table(self):
        captured = []

        async def fake_insert_query_audit(*_args, **_kwargs):
            captured.append("called")

        async def exercise():
            with patch("spc_backend.utils.db.run_sql", return_value=[]), patch(
                "spc_backend.utils.db.insert_spc_query_audit",
                fake_insert_query_audit,
            ):
                await db_module.run_sql_async(
                    "token",
                    f"INSERT INTO {db_module.tbl('spc_query_audit')} (query_id) VALUES ('1')",
                )
                await asyncio.sleep(0)

        asyncio.run(exercise())
        assert captured == []


async def test_attach_data_freshness_success():
    payload = {"data": 1}
    token = "token"
    views = ["v1"]
    mock_freshness = {"sources": [{"source_view": "v1", "last_altered_utc": "2026"}]}
    
    with patch("spc_backend.utils.db.get_data_freshness", return_value=mock_freshness):
        res = await db_module.attach_data_freshness(payload, token, views)
        assert res["data_freshness"] == mock_freshness

async def test_insert_spc_audit_event(monkeypatch):
    mock_run = AsyncMock(return_value=[])
    monkeypatch.setattr(db_module, "run_sql_async", mock_run)
    mat_id = test_data.material_id()
    
    await db_module.insert_spc_audit_event("token", event_type="test", detail={"material_id": mat_id})
    assert mock_run.called
    assert "INSERT INTO" in mock_run.call_args[0][1]

async def test_insert_spc_exclusion_snapshot(monkeypatch):
    mock_run = AsyncMock(return_value=[])
    monkeypatch.setattr(db_module, "run_sql_async", mock_run)
    mat_id = test_data.material_id()
    mic = test_data.mic_id()
    
    payload = {
        "event_id": "uuid", "material_id": mat_id, "mic_id": mic, "chart_type": "imr",
        "justification": "test", "excluded_count": 1, "excluded_points": []
    }
    await db_module.insert_spc_exclusion_snapshot("token", payload)
    assert mock_run.called
