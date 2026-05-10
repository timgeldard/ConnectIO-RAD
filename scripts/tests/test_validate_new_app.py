"""Tests for generated app scaffold validation."""
from __future__ import annotations

from scripts.validate_new_app import validate_app


def test_template_app_satisfies_scaffold_contract() -> None:
    """The reference template app validates as a generated bounded context."""
    assert validate_app("template") == []
