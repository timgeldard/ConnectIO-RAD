"""Unit tests for shared_db.query_builder."""

from __future__ import annotations

import pytest

from shared_db.query_builder import QueryBuilder


def test_query_builder_accepts_backtick_qualified_base_table() -> None:
    """Quoted catalog/schema/table references remain valid builder inputs."""
    builder = QueryBuilder(base_table="`catalog`.`schema`.`gold_plant`")

    sql, params = builder.with_order_by("PLANT_ID").build()

    assert "FROM `catalog`.`schema`.`gold_plant`" in sql
    assert "ORDER BY PLANT_ID" in sql
    assert params == []


def test_query_builder_rejects_unbalanced_backticks_in_base_table() -> None:
    """Malformed quoted identifiers must be rejected before SQL generation."""
    with pytest.raises(ValueError, match="base table"):
        QueryBuilder(base_table="`catalog`.`schema`.`gold_plant")


def test_query_builder_rejects_order_by_injection() -> None:
    """ORDER BY clauses only accept safe identifier syntax."""
    builder = QueryBuilder(base_table="gold_plant")

    with pytest.raises(ValueError, match="ORDER BY"):
        builder.with_order_by("PLANT_ID; DROP TABLE gold_plant")
