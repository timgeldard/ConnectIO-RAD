from __future__ import annotations

from argparse import Namespace

import pytest

from scripts import deploy_app


def _args(app_dir, *, dry_run: bool = True, run_migrations: bool = False) -> Namespace:
    return Namespace(
        app_dir=app_dir,
        manifest=None,
        profile=None,
        target=None,
        app_name=None,
        bundle_name=None,
        dry_run=dry_run,
        print_env=False,
        run_migrations=run_migrations,
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


def test_scoped_allow_empty_render_variables(tmp_path):
    manifest = {
        "allow_empty_render_variables": ["ROOT_VAR"],
        "profiles": {"uat": {"allow_empty_render_variables": ["UAT_VAR"]}},
        "targets": {"dev": {"allow_empty_render_variables": ["DEV_VAR"]}},
    }
    args = _args(tmp_path)

    # uat/dev scope
    args.profile = "uat"
    args.target = "dev"
    allowed = deploy_app.allow_empty_render_variables(manifest, args)
    assert allowed == {"ROOT_VAR", "UAT_VAR", "DEV_VAR"}

    # default scope
    args.profile = None
    args.target = None
    allowed = deploy_app.allow_empty_render_variables(manifest, args)
    assert allowed == {"ROOT_VAR", "UAT_VAR"}  # uat is default_profile


def test_post_deploy_validation_rejects_unsafe_paths(tmp_path):
    (tmp_path / "app.template.yaml").write_text("v: 1", encoding="utf-8")
    args = _args(tmp_path)
    valid_manifest = {
        "post_deploy": {
            "enabled": True,
            "workspace_files_path": "/Workspace/Shared/deploy",
        }
    }
    # Should not raise
    deploy_app.validate_config(valid_manifest, args, {})

    invalid_manifest = {
        "post_deploy": {
            "enabled": True,
            "workspace_files_path": "/tmp/unsafe",
        }
    }
    with pytest.raises(ValueError, match="must resolve to a /Workspace path"):
        deploy_app.validate_config(invalid_manifest, args, {})


def test_validate_config_validates_all_migrations(tmp_path):
    (tmp_path / "app.template.yaml").write_text("v: 1", encoding="utf-8")
    args = _args(tmp_path)
    manifest = {
        "migrations": [
            {"name": "valid", "warehouse_id": "abc"},
            {"name": "invalid", "warehouse_id": ""},
        ]
    }
    with pytest.raises(ValueError, match="must define warehouse_id or warehouse_id_env"):
        deploy_app.validate_config(manifest, args, {})


def test_prod_placeholders_fail_closed_unless_overridden(tmp_path):
    (tmp_path / "app.template.yaml").write_text("key: $PROD_VAR\n", encoding="utf-8")
    manifest = {
        "profiles": {"prod": {"env": {"PROD_VAR": ""}}},
    }
    args = _args(tmp_path)
    args.profile = "prod"

    # Fails by default because PROD_VAR is "" in manifest and not in env
    with pytest.raises(ValueError, match="PROD_VAR"):
        env = deploy_app.command_env(manifest, args)
        deploy_app.render_config(manifest, args, env)

    # Passes if overridden in real environment
    env_override = {"PROD_VAR": "real-value"}
    import os
    from unittest.mock import patch

    args.dry_run = False
    with patch.dict(os.environ, env_override):
        env = deploy_app.command_env(manifest, args)
        deploy_app.render_config(manifest, args, env)
        rendered = (tmp_path / "app.yaml").read_text(encoding="utf-8")
        assert "key: real-value" in rendered


def test_discover_bundled_app_manifests_loads_sub_app_deploy_tomls(tmp_path, monkeypatch):
    """`[platform].bundled_apps` should load each sub-app's deploy.toml."""
    # Pretend tmp_path is the repo root so `bundled_apps` paths resolve.
    monkeypatch.setattr(deploy_app, "ROOT", tmp_path)
    (tmp_path / "apps" / "spc").mkdir(parents=True)
    (tmp_path / "apps" / "spc" / "deploy.toml").write_text(
        '[app]\nname = "spc"\n\n[[migrations]]\nname = "spc_schema"\nfile = "m.sql"\nwarehouse_id = "wh"\n',
        encoding="utf-8",
    )
    (tmp_path / "apps" / "envmon").mkdir(parents=True)
    (tmp_path / "apps" / "envmon" / "deploy.toml").write_text(
        '[app]\nname = "envmon"\n',
        encoding="utf-8",
    )

    args = _args(tmp_path / "apps" / "platform")
    manifest = {"platform": {"bundled_apps": ["apps/spc", "apps/envmon", "apps/missing"]}}
    pairs = deploy_app.discover_bundled_app_manifests(manifest, args)

    # `apps/missing` is silently skipped (warn-only), the rest load.
    assert [p[0].name for p in pairs] == ["spc", "envmon"]
    assert pairs[0][1]["app"]["name"] == "spc"
    assert pairs[0][1]["migrations"][0]["name"] == "spc_schema"


def test_deploy_skips_migrations_unless_flag(tmp_path, monkeypatch, capsys):
    """`deploy()` must not auto-run migrations unless --run-migrations is set.

    Non-idempotent migrations + no applied-tracker mean repeated deploys
    would corrupt schema. The flag keeps schema-change deploys explicit.
    """
    monkeypatch.setattr(deploy_app, "ROOT", tmp_path)
    monkeypatch.setattr(deploy_app, "check_env", lambda *a, **k: None)
    monkeypatch.setattr(deploy_app, "build_frontend", lambda *a, **k: None)
    monkeypatch.setattr(deploy_app, "render_config", lambda *a, **k: None)
    monkeypatch.setattr(deploy_app, "bundle_deploy", lambda *a, **k: None)
    monkeypatch.setattr(deploy_app, "post_deploy", lambda *a, **k: None)
    monkeypatch.setattr(deploy_app, "run_hook_commands", lambda *a, **k: None)

    def _boom(*args, **kwargs):
        raise AssertionError("run_sql_migrations must not be called without --run-migrations")

    monkeypatch.setattr(deploy_app, "run_sql_migrations", _boom)

    manifest = {
        "app": {"name": "platform"},
        "migrations": [{"name": "m1", "file": "m.sql", "warehouse_id": "wh"}],
    }
    args = _args(tmp_path, dry_run=True, run_migrations=False)
    deploy_app.deploy(manifest, args, {})

    out = capsys.readouterr().out
    assert "SKIP 1 SQL migration" in out
    assert "--run-migrations" in out
