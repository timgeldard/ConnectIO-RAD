from __future__ import annotations

import asyncio
import hashlib
import json
import threading
from copy import deepcopy
from typing import Callable, Optional

from shared_db.core import TTLCache
from shared_db.errors import classify_sql_runtime_error
from shared_db.executors import _sql_executor


RunSql = Callable[[str, str, Optional[list[dict]]], list[dict]]

WRITE_SQL_PREFIXES = ("INSERT", "MERGE", "UPDATE", "DELETE", "ALTER", "CREATE", "DROP", "TRUNCATE", "OPTIMIZE", "VACUUM")
READ_SQL_PREFIXES = ("SELECT", "WITH", "SHOW", "DESCRIBE")


def statement_prefix(statement: str) -> str:
    stripped = statement.lstrip()
    return stripped.split(None, 1)[0].upper() if stripped else ""


def is_read_only_statement(statement: str) -> bool:
    return statement_prefix(statement) in READ_SQL_PREFIXES


def is_write_statement(statement: str) -> bool:
    return statement_prefix(statement) in WRITE_SQL_PREFIXES


def sql_cache_key(token: str, statement: str, params: Optional[list[dict]] = None) -> str:
    payload = json.dumps(params or [], sort_keys=True, default=str, separators=(",", ":"))
    return ":".join(
        [
            hashlib.sha256(token.encode()).hexdigest(),
            hashlib.sha256(statement.encode()).hexdigest(),
            hashlib.sha256(payload.encode()).hexdigest(),
        ]
    )


class SqlRuntime:
    def __init__(
        self,
        *,
        run_sql: RunSql,
        cache_maxsize: int = 100,
        cache_ttl_seconds: int = 300,
        cache_row_limit: int = 1000,
    ) -> None:
        self._run_sql = run_sql
        self.cache: TTLCache = TTLCache(maxsize=cache_maxsize, ttl=cache_ttl_seconds)
        self.cache_lock = threading.Lock()
        self.cache_row_limit = cache_row_limit

    def clear_cache(self) -> None:
        with self.cache_lock:
            self.cache.clear()
            expires = getattr(self.cache, "_expires", None)
            if isinstance(expires, dict):
                expires.clear()

    async def run_sql_async(
        self,
        token: str,
        statement: str,
        params: Optional[list[dict]] = None,
    ) -> list[dict]:
        try:
            if not is_read_only_statement(statement):
                loop = asyncio.get_running_loop()
                rows = await loop.run_in_executor(_sql_executor, lambda: self._run_sql(token, statement, params))
                if is_write_statement(statement):
                    self.clear_cache()
                return rows

            cache_key = sql_cache_key(token, statement, params)
            with self.cache_lock:
                cached_rows = self.cache.get(cache_key)
            if cached_rows is not None:
                return deepcopy(cached_rows)

            loop = asyncio.get_running_loop()
            rows = await loop.run_in_executor(_sql_executor, lambda: self._run_sql(token, statement, params))
            if len(rows) <= self.cache_row_limit:
                with self.cache_lock:
                    self.cache[cache_key] = deepcopy(rows)
            return rows
        except Exception as exc:
            mapped_error = classify_sql_runtime_error(exc)
            if mapped_error:
                raise mapped_error from exc
            raise
