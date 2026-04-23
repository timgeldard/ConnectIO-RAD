from __future__ import annotations

from argparse import Namespace

import pytest

from scripts import deploy_app


def _args(app_dir, *, dry_run: bool = True) -> Namespace:
    return Namespace(
        app_dir=app_dir,
        manifest=None,
        profile=None,
        target=None,
        app_name=None,
        bundle_name=None,
        dry_run=dry_run,
        print_env=False,
    )


def test_render_config_rejects_empty_values_unless_explicitly_allowed(tmp_path):
    (tmp_path / "app.template.yaml").write_text("value: $OPTIONAL_VALUE\n", encoding="utf-8")
    args = _args(tmp_path)
    manifest = {"env": {"OPTIONAL_VALUE": ""}}
    env = {"OPTIONAL_VALUE": ""}

    with pytest.raises(ValueError, match="OPTIONAL_VALUE"):
        deploy_app.render_config(manifest, args, env)

    deploy_app.render_config(
        {**manifest, "allow_empty_render_variables": ["OPTIONAL_VALUE"]},
        args,
        env,
    )


def test_resolve_migration_warehouse_id_fails_clearly_for_blank_ids():
    with pytest.raises(ValueError, match="must define warehouse_id or warehouse_id_env"):
        deploy_app.resolve_migration_warehouse_id({"name": "schema", "warehouse_id": ""}, {})

    with pytest.raises(ValueError, match="Missing warehouse id"):
        deploy_app.resolve_migration_warehouse_id({"name": "schema", "warehouse_id_env": "WAREHOUSE_ID"}, {})


def test_resolve_migration_warehouse_id_supports_literal_and_env_values():
    assert deploy_app.resolve_migration_warehouse_id({"name": "schema", "warehouse_id": "abc"}, {}) == "abc"
    assert (
        deploy_app.resolve_migration_warehouse_id(
            {"name": "schema", "warehouse_id_env": "WAREHOUSE_ID"},
            {"WAREHOUSE_ID": "xyz"},
        )
        == "xyz"
    )
