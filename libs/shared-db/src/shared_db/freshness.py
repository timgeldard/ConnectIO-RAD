from __future__ import annotations

import hashlib
import re
import time
import threading
from copy import deepcopy
from typing import Callable

from shared_db.core import TTLCache, sql_param


RunSql = Callable[[str, str, list[dict] | None], list[dict]]
StringGetter = Callable[[], str]

VIEW_NAME_RE = re.compile(r"^[A-Za-z0-9_]+$")


class DataFreshnessRuntime:
    def __init__(
        self,
        *,
        run_sql: RunSql,
        catalog: StringGetter,
        schema: StringGetter,
        cache_maxsize: int = 50,
        cache_ttl_seconds: int = 300,
    ) -> None:
        self._run_sql = run_sql
        self._catalog = catalog
        self._schema = schema
        self.cache: TTLCache = TTLCache(maxsize=cache_maxsize, ttl=cache_ttl_seconds)
        self.cache_lock = threading.Lock()

    def get_data_freshness(self, token: str, source_views: list[str]) -> dict:
        safe_views = sorted({view for view in source_views if VIEW_NAME_RE.match(view)})
        if not safe_views:
            return {"generated_at_utc": int(time.time()), "sources": []}

        catalog = self._catalog()
        schema = self._schema()
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        cache_key = (token_hash, catalog, schema, tuple(safe_views))
        with self.cache_lock:
            cached = self.cache.get(cache_key)
        if cached is not None:
            return deepcopy(cached)

        params = [
            sql_param("catalog_name", catalog),
            sql_param("schema_name", schema),
        ]
        view_clauses: list[str] = []
        for idx, view in enumerate(safe_views):
            param_name = f"view_{idx}"
            view_clauses.append(f"table_name = :{param_name}")
            params.append(sql_param(param_name, view))

        query = f"""
            SELECT
                table_name AS source_view,
                CAST(last_altered AS STRING) AS last_altered_utc
            FROM system.information_schema.tables
            WHERE table_catalog = :catalog_name
              AND table_schema = :schema_name
              AND ({' OR '.join(view_clauses)})
            ORDER BY table_name
        """
        rows = self._run_sql(token, query, params)
        result = {
            "generated_at_utc": int(time.time()),
            "catalog": catalog,
            "schema": schema,
            "sources": rows,
        }
        with self.cache_lock:
            self.cache[cache_key] = deepcopy(result)
        return result
