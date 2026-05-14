"""Tests for the parameterised IN-clause builder in the plant DAL.

The helper is the surface that defends against the previous f-string SQL
injection pattern (``", ".join(f"'{pid}'" for ...)``). These tests pin both
the safe SQL fragment shape and the matching named-parameter list.
"""

from envmon_backend.inspection_analysis.dal.plants import _plant_id_in_clause


def test_plant_id_in_clause_emits_named_placeholders():
    """Each plant ID becomes a ``:p<i>`` placeholder, never an inlined literal."""
    plants = ["IE01", "US01", "GB01"]
    in_clause, params = _plant_id_in_clause(plants)

    assert in_clause == f"({', '.join(f':p{i}' for i in range(len(plants)))})"
    assert [p["name"] for p in params] == [f"p{i}" for i in range(len(plants))]
    assert [p["value"] for p in params] == plants
    # Type is inferred per-value by sql_param; strings → STRING.
    assert all(p["type"] == "STRING" for p in params)


def test_plant_id_in_clause_handles_empty_list():
    """Empty input must produce a predicate that matches no rows, not a syntax error.

    A naïve f-string (``WHERE plant_id IN ()``) is a SQL syntax error;
    ``IN (NULL)`` is valid SQL that filters to zero rows.
    """
    in_clause, params = _plant_id_in_clause([])

    assert in_clause == "(NULL)"
    assert params == []


def test_plant_id_in_clause_does_not_inline_quoted_values():
    """Belt-and-braces: even an injection-shaped ID is bound, not concatenated."""
    in_clause, params = _plant_id_in_clause(["IE01' OR '1'='1"])

    # The IN clause must contain only the placeholder — the literal must NOT
    # appear in the SQL fragment, which is what the previous f-string version
    # let through.
    assert in_clause == "(:p0)"
    assert "OR" not in in_clause
    assert params[0]["value"] == "IE01' OR '1'='1"
