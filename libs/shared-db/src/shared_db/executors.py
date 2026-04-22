"""
SQL executor implementations for the Databricks Statement Execution REST API
and the Databricks SQL Connector.

Includes configurable exponential-backoff polling (from SPC reference impl).
"""

import hashlib
import json
import logging
import os
import re
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from typing import Optional, Protocol

try:
    from databricks import sql as databricks_sql
except ImportError:  # pragma: no cover
    databricks_sql = None

_SQL_MAX_WORKERS        = max(1, int(os.environ.get("SQL_MAX_WORKERS", "20")))
_SQL_POLL_MAX_ATTEMPTS  = max(1, int(os.environ.get("SQL_POLL_MAX_ATTEMPTS", "60")))
_SQL_POLL_INITIAL_DELAY_S = max(1, int(os.environ.get("SQL_POLL_INITIAL_DELAY_S", "2")))
_SQL_POLL_MAX_DELAY_S   = max(
    _SQL_POLL_INITIAL_DELAY_S,
    int(os.environ.get("SQL_POLL_MAX_DELAY_S", "30")),
)

_sql_executor = ThreadPoolExecutor(max_workers=_SQL_MAX_WORKERS, thread_name_prefix="sql")
_SQL_CONNECTOR_PARAM_RE = re.compile(r":([A-Za-z_][A-Za-z0-9_]*)")

logger = logging.getLogger(__name__)


class _SqlExecutor(Protocol):
    def execute(
        self,
        token: str,
        statement: str,
        params: Optional[list[dict]] = None,
    ) -> list[dict]: ...


def _sql_stmt_hash(statement: str) -> str:
    return hashlib.sha256(statement.encode()).hexdigest()[:16]


def _warehouse_id(warehouse_http_path: str) -> str:
    return warehouse_http_path.rsplit("/", 1)[-1]


def _params_to_mapping(params: Optional[list[dict]]) -> dict[str, object | None]:
    return {str(p["name"]): p.get("value") for p in (params or [])}


def _normalize_statement_for_connector(
    statement: str,
    params: Optional[list[dict]] = None,
) -> tuple[str, list[object | None]]:
    mapping = _params_to_mapping(params)
    positional: list[object | None] = []

    def replace(match: re.Match[str]) -> str:
        name = match.group(1)
        if name not in mapping:
            raise RuntimeError(f"Missing SQL parameter '{name}' for connector execution")
        positional.append(mapping[name])
        return "?"

    normalized = _SQL_CONNECTOR_PARAM_RE.sub(replace, statement)
    return normalized, positional


class _RestStatementExecutor:
    def execute(
        self,
        token: str,
        statement: str,
        params: Optional[list[dict]] = None,
        *,
        hostname: str = "",
        warehouse_http_path: str = "",
    ) -> list[dict]:
        from .core import hostname as _hostname, WAREHOUSE_HTTP_PATH
        _host = hostname or _hostname()
        _path = warehouse_http_path or WAREHOUSE_HTTP_PATH
        url = f"https://{_host}/api/2.0/sql/statements/"

        body: dict = {
            "warehouse_id": _warehouse_id(_path),
            "statement": statement,
            "wait_timeout": "50s",
        }
        if params:
            body["parameters"] = params

        stmt_hash = _sql_stmt_hash(statement)
        param_count = len(params) if params else 0
        body["query_tags"] = {"stmt_hash": stmt_hash}

        auth_headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        logger.info("sql.execute executor=rest hash=%s params=%d", stmt_hash, param_count)

        req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=auth_headers, method="POST")
        t0 = time.monotonic()
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                result = json.loads(resp.read().decode())
        except urllib.error.HTTPError as exc:
            body_str = exc.read().decode() if exc.fp else ""
            raise RuntimeError(f"SQL API {exc.code} {exc.reason}: {body_str[:2000]}") from exc

        state = result.get("status", {}).get("state", "")
        statement_id = result.get("statement_id", "")
        poll_url = f"https://{_host}/api/2.0/sql/statements/{statement_id}"

        poll_delay_s = _SQL_POLL_INITIAL_DELAY_S
        for _ in range(_SQL_POLL_MAX_ATTEMPTS):
            if state in ("SUCCEEDED", "FAILED", "CANCELED", "CLOSED"):
                break
            time.sleep(poll_delay_s)
            poll_req = urllib.request.Request(poll_url, headers=auth_headers)
            try:
                with urllib.request.urlopen(poll_req, timeout=30) as poll_resp:
                    result = json.loads(poll_resp.read().decode())
                    state = result.get("status", {}).get("state", "")
            except urllib.error.HTTPError as exc:
                body_str = exc.read().decode() if exc.fp else ""
                raise RuntimeError(f"SQL poll {exc.code}: {body_str[:1000]}") from exc
            poll_delay_s = min(_SQL_POLL_MAX_DELAY_S, poll_delay_s * 2)

        elapsed_ms = int((time.monotonic() - t0) * 1000)
        if state != "SUCCEEDED":
            error_info = result.get("status", {}).get("error", {})
            msg = error_info.get("message", f"Query ended with state: {state}")
            logger.warning("sql.failed hash=%s state=%s duration_ms=%d", stmt_hash, state, elapsed_ms)
            raise RuntimeError(msg)

        columns = [c["name"] for c in result["manifest"]["schema"]["columns"]]
        all_rows: list[dict] = []
        chunk = result.get("result", {})
        while True:
            for row_data in chunk.get("data_array", []):
                all_rows.append(dict(zip(columns, row_data)))
            next_chunk_index = chunk.get("next_chunk_index")
            if next_chunk_index is None:
                break
            chunk_url = f"{poll_url}/result/chunks/{next_chunk_index}"
            chunk_req = urllib.request.Request(chunk_url, headers=auth_headers)
            try:
                with urllib.request.urlopen(chunk_req, timeout=60) as chunk_resp:
                    chunk = json.loads(chunk_resp.read().decode())
            except urllib.error.HTTPError as exc:
                body_str = exc.read().decode() if exc.fp else ""
                raise RuntimeError(f"SQL chunk fetch {exc.code}: {body_str[:1000]}") from exc

        logger.info("sql.done hash=%s rows=%d duration_ms=%d", stmt_hash, len(all_rows), elapsed_ms)
        return all_rows


class _ConnectorStatementExecutor:
    def execute(
        self,
        token: str,
        statement: str,
        params: Optional[list[dict]] = None,
        *,
        hostname: str = "",
        warehouse_http_path: str = "",
    ) -> list[dict]:
        if databricks_sql is None:
            raise RuntimeError("databricks-sql-connector is not installed")

        from .core import hostname as _hostname, WAREHOUSE_HTTP_PATH
        _host = hostname or _hostname()
        _path = warehouse_http_path or WAREHOUSE_HTTP_PATH

        normalized_statement, positional_params = _normalize_statement_for_connector(statement, params)
        stmt_hash = _sql_stmt_hash(statement)
        logger.info("sql.execute executor=connector hash=%s params=%d", stmt_hash, len(positional_params))
        t0 = time.monotonic()

        try:
            with databricks_sql.connect(
                server_hostname=_host,
                http_path=_path,
                access_token=token,
            ) as connection:
                with connection.cursor() as cursor:
                    if positional_params:
                        cursor.execute(normalized_statement, positional_params)
                    else:
                        cursor.execute(normalized_statement)
                    description = cursor.description or []
                    columns = [col[0] for col in description]
                    raw_rows = cursor.fetchall() or []
        except Exception as exc:
            raise RuntimeError(str(exc)) from exc

        rows = [
            dict(r) if isinstance(r, dict) else dict(zip(columns, list(r)))
            for r in raw_rows
        ]
        elapsed_ms = int((time.monotonic() - t0) * 1000)
        logger.info("sql.done executor=connector hash=%s rows=%d duration_ms=%d", stmt_hash, len(rows), elapsed_ms)
        return rows


_REST_EXECUTOR: _SqlExecutor = _RestStatementExecutor()
_CONNECTOR_EXECUTOR: _SqlExecutor = _ConnectorStatementExecutor()
