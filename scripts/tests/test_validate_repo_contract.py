"""Regression tests for repository contract validation helpers."""

from __future__ import annotations

import scripts.validate_repo_contract as contract


def test_shared_domain_purity_flags_infrastructure_imports(tmp_path, monkeypatch):
    """shared-domain must stay free of transport and persistence imports."""
    root = tmp_path
    module = root / "libs" / "shared-domain" / "src" / "shared_domain" / "bad.py"
    module.parent.mkdir(parents=True)
    module.write_text("from fastapi import APIRouter\nfrom pydantic.dataclasses import dataclass\n", encoding="utf-8")
    monkeypatch.setattr(contract, "ROOT", root)

    errors: list[str] = []
    contract.validate_shared_library_purity(errors)

    assert errors == [
        "libs/shared-domain/src/shared_domain/bad.py: shared-domain must not import infrastructure module `fastapi`"
    ]


def test_forbidden_placeholder_scan_uses_regex(tmp_path, monkeypatch):
    """Forbidden production scans catch variants that literal matching misses."""
    app_file = tmp_path / "apps" / "spc" / "frontend" / "src" / "App.tsx"
    app_file.parent.mkdir(parents=True)
    app_file.write_text('const id = useState( "20582002" )\n', encoding="utf-8")
    monkeypatch.setattr(contract, "ROOT", tmp_path)
    monkeypatch.setattr(contract, "PRODUCTION_APP_DIRS", ("spc",))

    errors: list[str] = []
    contract.validate_forbidden_placeholders(errors)

    assert errors == [
        "apps/spc/frontend/src/App.tsx: forbidden placeholder `useState\\s*\\(\\s*['\\\"]20582002['\\\"]\\s*\\)`. Material context must come from session, search, or deep link."
    ]


def test_connectedquality_aggregator_scope_rejects_sibling_domain_import(tmp_path, monkeypatch):
    """ConnectedQuality may aggregate sibling DALs, but not sibling domains."""
    app_root = tmp_path / "apps" / "connectedquality" / "backend" / "connectedquality_backend"
    app_file = app_root / "application" / "bad.py"
    app_file.parent.mkdir(parents=True)
    app_file.write_text("from spc_backend.process_control.domain.entities import Chart\n", encoding="utf-8")
    monkeypatch.setattr(contract, "ROOT", tmp_path)

    errors: list[str] = []
    contract.validate_connectedquality_aggregator_scope(errors)

    assert errors == [
        "apps/connectedquality/backend/connectedquality_backend/application/bad.py: connectedquality aggregator must not import sibling domain `spc_backend.process_control.domain.entities`",
        "apps/connectedquality/backend/connectedquality_backend/application/bad.py: connectedquality aggregator import `spc_backend.process_control.domain.entities` is outside the bounded exception",
    ]
