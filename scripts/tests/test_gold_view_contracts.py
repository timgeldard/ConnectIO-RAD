"""SQL-contract smoke test — every entities.yaml view exists and is readable.

This is the H-4 fix from the architecture review.  Previously the DAL layer
was uniformly mocked, so a Unity-Catalog schema drift (a renamed column, a
dropped view) would not be caught until the live E2E job ran post-merge.

This test executes a ``SELECT * FROM <entity> LIMIT 1`` against every entity
declared APPROVED in ``entities.yaml`` against the warehouse identified by
``DATABRICKS_HOST`` + ``DATABRICKS_WAREHOUSE_HTTP_PATH`` + ``DATABRICKS_TOKEN``.

It is **skipped** when those env vars are absent so it costs nothing on a
laptop without credentials.  In CI it is invoked post-merge as part of the
``e2e-live`` job, alongside Playwright, against the UAT workspace.

The test does NOT assert column shapes or row contents — that is the
``entities.yaml`` ``important_dimensions`` block's job, and an extension of
this test could later read that block and check column presence.  Today's
contract is simply: "the view exists, the agent can read it, and the
columns this app queries do not throw".
"""
from __future__ import annotations

import os
from pathlib import Path

import pytest
import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
SEMANTIC_MODEL = REPO_ROOT / "ai-context" / "semantic-model" / "entities.yaml"


def _env_complete() -> bool:
    """Return True if every required Databricks credential env var is set."""
    return all(
        os.environ.get(k)
        for k in ("DATABRICKS_HOST", "DATABRICKS_WAREHOUSE_HTTP_PATH", "DATABRICKS_TOKEN")
    )


def _approved_entities() -> list[dict]:
    """Return the APPROVED entities from entities.yaml."""
    with SEMANTIC_MODEL.open("r", encoding="utf-8") as f:
        model = yaml.safe_load(f)
    return [
        e for e in model.get("entities", [])
        if e.get("tier") == "APPROVED" and e.get("approved_for_agent_use", True)
    ]


pytestmark = pytest.mark.skipif(
    not _env_complete(),
    reason=(
        "Skipping live gold-view contract test — DATABRICKS_HOST / "
        "DATABRICKS_WAREHOUSE_HTTP_PATH / DATABRICKS_TOKEN not set. "
        "Run in CI's e2e-live job against UAT."
    ),
)


@pytest.fixture(scope="module")
def databricks_executor():
    """Yield a callable that runs a SQL statement against the configured warehouse.

    Uses the shared ``_RestStatementExecutor`` so the test exercises the same
    code path production endpoints use.
    """
    from shared_db.executors import _RestStatementExecutor

    executor = _RestStatementExecutor(
        host=os.environ["DATABRICKS_HOST"],
        warehouse_http_path=os.environ["DATABRICKS_WAREHOUSE_HTTP_PATH"],
        token=os.environ["DATABRICKS_TOKEN"],
    )

    def _run(sql: str) -> list[dict]:
        return executor.execute(sql, params=None)

    return _run


def _qualify(name: str) -> str:
    """Qualify an entity name with the active catalog and gold schema."""
    catalog = os.environ.get("TRACE_CATALOG", "")
    if not catalog:
        pytest.skip("TRACE_CATALOG is empty; cannot qualify gold-view name")
    return f"`{catalog}`.`gold`.`{name}`"


@pytest.mark.integration
@pytest.mark.parametrize(
    "entity",
    _approved_entities(),
    ids=lambda e: e["name"],
)
def test_entity_exists_and_is_readable(databricks_executor, entity):
    """Each approved entity must respond to ``SELECT * ... LIMIT 1`` without error."""
    name = entity["name"]
    sql = f"SELECT * FROM {_qualify(name)} LIMIT 1"
    try:
        databricks_executor(sql)
    except Exception as exc:
        pytest.fail(
            f"Approved entity {name!r} is unreadable in the live warehouse: {exc}\n"
            f"This indicates schema drift between entities.yaml and Unity Catalog.\n"
            f"SQL: {sql}"
        )


@pytest.mark.integration
@pytest.mark.parametrize(
    "entity",
    [e for e in _approved_entities() if e.get("important_dimensions")],
    ids=lambda e: e["name"],
)
def test_entity_important_dimensions_present(databricks_executor, entity):
    """Each entity's declared ``important_dimensions`` columns must exist on the view.

    Catches the column-rename case that ``test_entity_exists_and_is_readable``
    misses — the view answers ``SELECT *`` but the column an app expects has
    been removed or renamed.
    """
    name = entity["name"]
    columns = [d["name"] for d in entity["important_dimensions"]]
    col_sql = ", ".join(f"`{c}`" for c in columns)
    sql = f"SELECT {col_sql} FROM {_qualify(name)} LIMIT 1"
    try:
        databricks_executor(sql)
    except Exception as exc:
        pytest.fail(
            f"Entity {name!r} is missing one or more important_dimensions "
            f"columns: {columns!r}\n"
            f"Underlying error: {exc}"
        )
