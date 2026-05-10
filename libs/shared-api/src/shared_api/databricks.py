"""Databricks SQL runtime helpers for shared-api."""
from __future__ import annotations

import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class DatabricksSqlSettings:
    """Databricks SQL connection settings resolved from the environment."""

    server_hostname: str | None = None
    http_path: str | None = None
    catalog: str | None = None
    schema: str | None = None
    pool_size: int = 5
    max_overflow: int = 10

    @classmethod
    def from_env(cls) -> "DatabricksSqlSettings":
        """Build settings from common Databricks Apps environment variables."""
        return cls(
            server_hostname=os.environ.get("DATABRICKS_HOST") or os.environ.get("DATABRICKS_SERVER_HOSTNAME"),
            http_path=os.environ.get("DATABRICKS_WAREHOUSE_HTTP_PATH") or os.environ.get("WAREHOUSE_HTTP_PATH"),
            catalog=os.environ.get("DATABRICKS_CATALOG") or os.environ.get("TRACE_CATALOG"),
            schema=os.environ.get("DATABRICKS_SCHEMA") or os.environ.get("TRACE_SCHEMA"),
            pool_size=int(os.environ.get("DATABRICKS_SQL_POOL_SIZE", "5")),
            max_overflow=int(os.environ.get("DATABRICKS_SQL_MAX_OVERFLOW", "10")),
        )

    @property
    def configured(self) -> bool:
        """Return True when required SQL endpoint settings are present."""
        return bool(self.server_hostname and self.http_path)


class DatabricksSqlRuntime:
    """Optional async SQLAlchemy runtime for Databricks SQL.

    The class is intentionally lazy: importing shared-api does not require
    SQLAlchemy or a Databricks dialect. Apps that need pooled SQL access can
    call :meth:`create_engine` during FastAPI lifespan.
    """

    def __init__(self, settings: DatabricksSqlSettings | None = None) -> None:
        """Create a runtime from explicit settings or environment defaults."""
        self.settings = settings or DatabricksSqlSettings.from_env()
        self.engine: Any | None = None

    def create_engine(self, *, access_token: str | None = None) -> Any | None:
        """Create an async SQLAlchemy engine when optional dependencies exist."""
        if not self.settings.configured or not access_token:
            return None
        try:
            from sqlalchemy.ext.asyncio import create_async_engine
        except Exception:
            return None

        # Placeholder URL keeps dialect choice app-configurable. Production
        # deployments should set DATABRICKS_SQLALCHEMY_URL when using pooled
        # SQLAlchemy; otherwise apps can keep shared-db run_sql_async.
        url = os.environ.get("DATABRICKS_SQLALCHEMY_URL")
        if not url:
            return None
        self.engine = create_async_engine(
            url,
            pool_size=self.settings.pool_size,
            max_overflow=self.settings.max_overflow,
            connect_args={"access_token": access_token},
        )
        return self.engine

    async def dispose(self) -> None:
        """Dispose the SQLAlchemy engine if one was created."""
        if self.engine is not None:
            await self.engine.dispose()
            self.engine = None


@asynccontextmanager
async def databricks_sql_lifespan(runtime: DatabricksSqlRuntime) -> AsyncIterator[DatabricksSqlRuntime]:
    """FastAPI lifespan helper that disposes pooled Databricks SQL resources."""
    try:
        yield runtime
    finally:
        await runtime.dispose()
