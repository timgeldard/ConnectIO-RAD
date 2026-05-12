"""Regression tests for repository contract validation helpers."""

from __future__ import annotations

import scripts.validate_repo_contract as contract


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
