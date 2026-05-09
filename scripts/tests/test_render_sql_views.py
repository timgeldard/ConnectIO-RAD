"""Unit tests for render_sql_views.py template substitution."""
from __future__ import annotations

import sys
import pathlib
import textwrap
import tomllib
from unittest.mock import patch, MagicMock

import pytest

# Make scripts importable
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import render_sql_views as rsv


@pytest.fixture
def tmp_app(tmp_path):
    """A minimal fake app tree with a deploy.toml and one SQL view template."""
    app_dir = tmp_path / "apps" / "myapp"
    views_dir = app_dir / "sql" / "views"
    views_dir.mkdir(parents=True)

    (app_dir / "deploy.toml").write_text(textwrap.dedent("""        [app]
        name = "myapp"

        [targets.uat.env]
        TRACE_CATALOG = "connected_plant_uat"
        PUBLISHED_CATALOG = "published_uat"

        [targets.prod.env]
        TRACE_CATALOG = "connected_plant_prod"
        PUBLISHED_CATALOG = "published_prod"
    """), encoding="utf-8")

    (views_dir / "01_test_v.sql").write_text(
        "SELECT * FROM ${TRACE_CATALOG}.schema.table
"
        "JOIN ${PUBLISHED_CATALOG}.cs.batches ON 1=1
",
        encoding="utf-8",
    )
    return tmp_path, app_dir, views_dir


def test_render_substitutes_uat_variables(tmp_app, monkeypatch):
    tmp_root, app_dir, views_dir = tmp_app
    monkeypatch.setattr(rsv, "ROOT", tmp_app[0])

    result = rsv.render_views("myapp", "uat")
    assert result == 0

    rendered = (views_dir / "rendered" / "uat" / "01_test_v.sql").read_text()
    assert "connected_plant_uat" in rendered
    assert "published_uat" in rendered
    assert "${" not in rendered


def test_render_substitutes_prod_variables(tmp_app, monkeypatch):
    tmp_root, app_dir, views_dir = tmp_app
    monkeypatch.setattr(rsv, "ROOT", tmp_app[0])

    result = rsv.render_views("myapp", "prod")
    assert result == 0

    rendered = (views_dir / "rendered" / "prod" / "01_test_v.sql").read_text()
    assert "connected_plant_prod" in rendered
    assert "published_prod" in rendered


def test_render_returns_error_on_missing_variable(tmp_app, monkeypatch):
    tmp_root, app_dir, views_dir = tmp_app
    monkeypatch.setattr(rsv, "ROOT", tmp_app[0])

    # Inject a SQL file with an undefined variable
    (views_dir / "99_bad_v.sql").write_text("SELECT ${UNDEFINED_VAR}", encoding="utf-8")

    result = rsv.render_views("myapp", "uat")
    assert result == 1


def test_render_skips_app_with_no_views_dir(tmp_app, monkeypatch):
    tmp_root, app_dir, views_dir = tmp_app
    monkeypatch.setattr(rsv, "ROOT", tmp_app[0])

    result = rsv.render_views("nonexistent_app", "uat")
    assert result == 0
