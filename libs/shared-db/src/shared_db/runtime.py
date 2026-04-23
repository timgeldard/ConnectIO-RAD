from __future__ import annotations

import asyncio
import hashlib
import inspect
import json
import logging
import threading
from collections.abc import Awaitable
from copy import deepcopy
from dataclasses import dataclass
from typing import Callable, Optional

from shared_db.core import TTLCache
from shared_db.errors import classify_sql_runtime_error
from shared_db.executors import _sql_executor


RunSql = Callable[[str, str, Optional[list[dict]]], list[dict]]
AuditHook = Callable[..., None | Awaitable[None]]

WRITE_SQL_PREFIXES = ("INSERT", "MERGE", "UPDATE", "DELETE", "ALTER", "CREATE", "DROP", "TRUNCATE", "OPTIMIZE", "VACUUM")
READ_SQL_PREFIXES = ("SELECT", "WITH", "SHOW", "DESCRIBE")
logger = logging.getLogger(__name__)


def _strip_leading_comments(statement: str) -> str:
    stripped = statement.lstrip()
    while stripped:
        if stripped.startswith("--"):
            _, separator, rest = stripped.partition("\n")
            stripped = rest.lstrip() if separator else ""
            continue
        if stripped.startswith("/*"):
            end = stripped.find("*/")
            if end == -1:
                return ""
            stripped = stripped[end + 2 :].lstrip()
            continue
        return stripped
    return stripped


def statement_prefix(statement: str) -> str:
    stripped = _strip_leading_comments(statement)
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


@dataclass(frozen=True)
class CacheTier:
    name: str
    maxsize: int = 100
    ttl_seconds: int = 300
    row_limit: int = 1000
    prefixes: tuple[str, ...] = READ_SQL_PREFIXES

    def matches(self, statement: str) -> bool:
        return statement_prefix(statement) in self.prefixes


@dataclass(frozen=True)
class CachePolicy:
    tiers: tuple[CacheTier, ...]

    @classmethod
    def single(cls, *, maxsize: int = 100, ttl_seconds: int = 300, row_limit: int = 1000) -> "CachePolicy":
        return cls((CacheTier("default", maxsize=maxsize, ttl_seconds=ttl_seconds, row_limit=row_limit),))

    @classmethod
    def tiered(cls, *tiers: CacheTier) -> "CachePolicy":
        if not tiers:
            raise ValueError("CachePolicy.tiered requires at least one cache tier")
        return cls(tuple(tiers))


class SqlRuntime:
    def __init__(
        self,
        *,
        run_sql: RunSql,
        cache_maxsize: int = 100,
        cache_ttl_seconds: int = 300,
        cache_row_limit: int = 1000,
        cache_policy: CachePolicy | None = None,
        audit_hook: AuditHook | None = None,
    ) -> None:
        self._run_sql = run_sql
        self.cache_policy = cache_policy or CachePolicy.single(
            maxsize=cache_maxsize,
            ttl_seconds=cache_ttl_seconds,
            row_limit=cache_row_limit,
        )
        self._audit_hook = audit_hook
        self._tier_caches = {
            tier.name: TTLCache(maxsize=tier.maxsize, ttl=tier.ttl_seconds) for tier in self.cache_policy.tiers
        }
        self.cache: TTLCache = self._tier_caches[self.cache_policy.tiers[0].name]
        self.cache_lock = threading.Lock()
        self.cache_row_limit = self.cache_policy.tiers[0].row_limit

    def clear_cache(self) -> None:
        with self.cache_lock:
            for cache in self._tier_caches.values():
                cache.clear()
                expires = getattr(cache, "_expires", None)
                if isinstance(expires, dict):
                    expires.clear()

    def _cache_tier_for(self, statement: str) -> CacheTier | None:
        if not is_read_only_statement(statement):
            return None
        for tier in self.cache_policy.tiers:
            if tier.matches(statement):
                return tier
        return None

    async def _audit(
        self,
        *,
        token: str,
        statement: str,
        params: Optional[list[dict]],
        endpoint_hint: str,
        rows: list[dict] | None = None,
        error: Exception | None = None,
    ) -> None:
        if self._audit_hook is None:
            return
        try:
            result = self._audit_hook(
                token=token,
                statement=statement,
                params=params,
                endpoint_hint=endpoint_hint,
                rows=rows,
                error=error,
            )
            if inspect.isawaitable(result):
                await result
        except Exception:
            logger.warning("sql.audit_hook_failed endpoint=%s", endpoint_hint, exc_info=True)

    async def run_sql_async(
        self,
        token: str,
        statement: str,
        params: Optional[list[dict]] = None,
        *,
        endpoint_hint: str = "unknown",
        audit: bool = True,
    ) -> list[dict]:
        try:
            tier = self._cache_tier_for(statement)
            if tier is None:
                loop = asyncio.get_running_loop()
                rows = await loop.run_in_executor(_sql_executor, lambda: self._run_sql(token, statement, params))
                if is_write_statement(statement):
                    self.clear_cache()
                if audit:
                    await self._audit(
                        token=token,
                        statement=statement,
                        params=params,
                        endpoint_hint=endpoint_hint,
                        rows=rows,
                    )
                return rows

            cache_key = f"{tier.name}:{sql_cache_key(token, statement, params)}"
            cache = self._tier_caches[tier.name]
            with self.cache_lock:
                cached_rows = cache.get(cache_key)
            if cached_rows is not None:
                return deepcopy(cached_rows)

            loop = asyncio.get_running_loop()
            rows = await loop.run_in_executor(_sql_executor, lambda: self._run_sql(token, statement, params))
            if len(rows) <= tier.row_limit:
                with self.cache_lock:
                    cache[cache_key] = deepcopy(rows)
            if audit:
                await self._audit(
                    token=token,
                    statement=statement,
                    params=params,
                    endpoint_hint=endpoint_hint,
                    rows=rows,
                )
            return rows
        except Exception as exc:
            if audit:
                await self._audit(
                    token=token,
                    statement=statement,
                    params=params,
                    endpoint_hint=endpoint_hint,
                    error=exc,
                )
            mapped_error = classify_sql_runtime_error(exc)
            if mapped_error:
                raise mapped_error from exc
            raise
