"""
Tests for _RestStatementExecutor: inline and EXTERNAL_LINKS disposition.
"""
import json
from unittest.mock import MagicMock, patch

import pytest

from shared_db.executors import _RestStatementExecutor


def _make_response(data: dict | list) -> MagicMock:
    """Build a mock context manager returned by urllib.request.urlopen."""
    body = json.dumps(data).encode()
    cm = MagicMock()
    cm.__enter__ = MagicMock(return_value=cm)
    cm.__exit__ = MagicMock(return_value=False)
    cm.read.return_value = body
    return cm


_COLUMNS = [{"name": "id"}, {"name": "val"}]

_SUCCEEDED_INLINE = {
    "statement_id": "stmt-001",
    "status": {"state": "SUCCEEDED"},
    "manifest": {"schema": {"columns": _COLUMNS}},
    "result": {"data_array": [["1", "alpha"], ["2", "beta"]]},
}

_SUCCEEDED_EXTERNAL = {
    "statement_id": "stmt-002",
    "status": {"state": "SUCCEEDED"},
    "manifest": {"schema": {"columns": _COLUMNS}},
    "result": {
        "external_links": [
            {"external_link": "https://presigned.example.com/chunk0", "chunk_index": 0}
        ]
    },
}

_PRESIGNED_ROWS = [["1", "alpha"], ["2", "beta"]]


@pytest.fixture(autouse=True)
def _env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABRICKS_HOST", "test.azuredatabricks.net")
    monkeypatch.setenv("DATABRICKS_WAREHOUSE_HTTP_PATH", "/sql/1.0/warehouses/abc123")


class TestInlineDisposition:
    def test_disposition_absent_by_default(self) -> None:
        """Default (large_result=False) must not include 'disposition' in the request body."""
        executor = _RestStatementExecutor()
        captured: list[dict] = []

        def fake_open(req, timeout=None):
            if getattr(req, "data", None):
                captured.append(json.loads(req.data.decode()))
            return _make_response(_SUCCEEDED_INLINE)

        with patch("urllib.request.urlopen", side_effect=fake_open):
            rows = executor.execute("tok", "SELECT 1")

        assert "disposition" not in captured[0]
        assert rows == [{"id": "1", "val": "alpha"}, {"id": "2", "val": "beta"}]

    def test_inline_data_array_parsed(self) -> None:
        executor = _RestStatementExecutor()
        with patch("urllib.request.urlopen", return_value=_make_response(_SUCCEEDED_INLINE)):
            rows = executor.execute("tok", "SELECT 1")
        assert rows == [{"id": "1", "val": "alpha"}, {"id": "2", "val": "beta"}]


class TestExternalLinksDisposition:
    def test_disposition_field_set_to_external_links(self) -> None:
        """large_result=True must add 'disposition': 'EXTERNAL_LINKS' to the POST body."""
        executor = _RestStatementExecutor()
        captured: list[dict] = []

        def fake_open(req, timeout=None):
            if getattr(req, "data", None):
                captured.append(json.loads(req.data.decode()))
                return _make_response(_SUCCEEDED_EXTERNAL)
            return _make_response(_PRESIGNED_ROWS)

        with patch("urllib.request.urlopen", side_effect=fake_open):
            executor.execute("tok", "SELECT 1", large_result=True)

        assert captured[0]["disposition"] == "EXTERNAL_LINKS"

    def test_presigned_url_has_no_authorization_header(self) -> None:
        """Pre-signed URL fetches must not carry an Authorization header."""
        executor = _RestStatementExecutor()
        unsigned_requests: list = []

        def fake_open(req, timeout=None):
            if getattr(req, "data", None):
                return _make_response(_SUCCEEDED_EXTERNAL)
            unsigned_requests.append(req)
            return _make_response(_PRESIGNED_ROWS)

        with patch("urllib.request.urlopen", side_effect=fake_open):
            executor.execute("tok", "SELECT 1", large_result=True)

        assert len(unsigned_requests) == 1
        assert unsigned_requests[0].get_header("Authorization") is None

    def test_external_links_rows_assembled_with_column_names(self) -> None:
        executor = _RestStatementExecutor()

        def fake_open(req, timeout=None):
            if getattr(req, "data", None):
                return _make_response(_SUCCEEDED_EXTERNAL)
            return _make_response(_PRESIGNED_ROWS)

        with patch("urllib.request.urlopen", side_effect=fake_open):
            rows = executor.execute("tok", "SELECT 1", large_result=True)

        assert rows == [{"id": "1", "val": "alpha"}, {"id": "2", "val": "beta"}]

    def test_multiple_external_link_chunks(self) -> None:
        """next_chunk_index on the result triggers a second chunk API call for more links."""
        executor = _RestStatementExecutor()

        first_result = {
            "statement_id": "stmt-003",
            "status": {"state": "SUCCEEDED"},
            "manifest": {"schema": {"columns": [{"name": "n"}]}},
            "result": {
                "external_links": [
                    {"external_link": "https://presigned.example.com/chunk0", "chunk_index": 0}
                ],
                "next_chunk_index": 1,
            },
        }
        chunk1_api_response = {
            "external_links": [
                {"external_link": "https://presigned.example.com/chunk1", "chunk_index": 1}
            ],
        }

        def fake_open(req, timeout=None):
            url = req.full_url if hasattr(req, "full_url") else req.get_full_url()
            if getattr(req, "data", None):
                return _make_response(first_result)
            if "result/chunks/1" in url:
                return _make_response(chunk1_api_response)
            if "chunk0" in url:
                return _make_response([["10"]])
            if "chunk1" in url:
                return _make_response([["20"]])
            return _make_response({})

        with patch("urllib.request.urlopen", side_effect=fake_open):
            rows = executor.execute("tok", "SELECT 1", large_result=True)

        assert rows == [{"n": "10"}, {"n": "20"}]


class TestRunSqlLarge:
    def test_run_sql_large_passes_large_result_true(self) -> None:
        """run_sql_large must call the REST executor with large_result=True."""
        with patch("shared_db.executors._REST_EXECUTOR") as mock_exec:
            mock_exec.execute.return_value = [{"x": "1"}]
            from shared_db.core import run_sql_large

            rows = run_sql_large("tok", "SELECT 1")

        _args, kwargs = mock_exec.execute.call_args
        assert kwargs.get("large_result") is True
        assert rows == [{"x": "1"}]

    def test_run_sql_large_does_not_cache(self) -> None:
        """run_sql_large must bypass the TTL cache (call executor on every invocation)."""
        with patch("shared_db.executors._REST_EXECUTOR") as mock_exec:
            mock_exec.execute.return_value = [{"x": "1"}]
            from shared_db.core import run_sql_large

            run_sql_large("tok", "SELECT 1")
            run_sql_large("tok", "SELECT 1")

        assert mock_exec.execute.call_count == 2

    def test_run_sql_large_async_passes_large_result_true(self) -> None:
        """run_sql_large_async must call the REST executor with large_result=True."""
        import asyncio

        with patch("shared_db.executors._REST_EXECUTOR") as mock_exec:
            mock_exec.execute.return_value = [{"y": "2"}]
            from shared_db.core import run_sql_large_async

            rows = asyncio.run(run_sql_large_async("tok", "SELECT 2"))

        _args, kwargs = mock_exec.execute.call_args
        assert kwargs.get("large_result") is True
        assert rows == [{"y": "2"}]
