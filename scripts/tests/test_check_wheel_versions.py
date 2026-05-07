"""Tests for the wheel-version-bump guard.

The script under test is ``scripts/check_wheel_versions.py``. It compares two
git refs and complains if any wheel-bundled package's source changed without
a corresponding ``pyproject.toml`` version bump.

These tests build a tiny throwaway git repo with a single fake "package", then
exercise the script via importable functions (no subprocess shelling).
"""
from __future__ import annotations

import importlib.util
import subprocess
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT_PATH = REPO_ROOT / "scripts" / "check_wheel_versions.py"


def _load_module(monkeypatch, repo_root: Path):
    """Load check_wheel_versions with ROOT pointed at a temp repo."""
    spec = importlib.util.spec_from_file_location("check_wheel_versions", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    monkeypatch.setattr(module, "ROOT", repo_root)
    return module


def _git(repo: Path, *args: str) -> str:
    return subprocess.check_output(
        ["git", *args], cwd=repo, text=True, stderr=subprocess.STDOUT
    )


def _mk_pyproject(version: str) -> str:
    return f'[project]\nname = "fake-pkg"\nversion = "{version}"\n'


@pytest.fixture
def fake_repo(tmp_path: Path) -> Path:
    """Initialise a git repo with one fake package at version 0.1.0."""
    _git(tmp_path, "init", "-q", "-b", "main")
    _git(tmp_path, "config", "user.email", "test@example.com")
    _git(tmp_path, "config", "user.name", "test")

    pkg = tmp_path / "libs" / "fake-pkg"
    pkg.mkdir(parents=True)
    (pkg / "pyproject.toml").write_text(_mk_pyproject("0.1.0"))
    (pkg / "src.py").write_text("VALUE = 1\n")
    _git(tmp_path, "add", ".")
    _git(tmp_path, "commit", "-q", "-m", "initial")
    return tmp_path


def test_passes_when_no_changes(fake_repo, monkeypatch):
    """Same source, same version — no failures."""
    module = _load_module(monkeypatch, fake_repo)
    monkeypatch.setattr(module, "PACKAGES", ["libs/fake-pkg"])

    rc = module.main(["--base=HEAD", "--head=HEAD"])

    assert rc == 0


def test_fails_when_source_changed_without_bump(fake_repo, monkeypatch, capsys):
    """Source change, version unchanged — fails with a clear message."""
    module = _load_module(monkeypatch, fake_repo)
    monkeypatch.setattr(module, "PACKAGES", ["libs/fake-pkg"])

    base = _git(fake_repo, "rev-parse", "HEAD").strip()
    (fake_repo / "libs" / "fake-pkg" / "src.py").write_text("VALUE = 2\n")
    _git(fake_repo, "commit", "-aq", "-m", "change source")

    rc = module.main([f"--base={base}", "--head=HEAD"])

    assert rc == 1
    captured = capsys.readouterr()
    assert "libs/fake-pkg" in captured.err
    assert "version 0.1.0" in captured.err


def test_passes_when_source_changed_and_bumped(fake_repo, monkeypatch):
    """Source change AND version bump — passes."""
    module = _load_module(monkeypatch, fake_repo)
    monkeypatch.setattr(module, "PACKAGES", ["libs/fake-pkg"])

    base = _git(fake_repo, "rev-parse", "HEAD").strip()
    (fake_repo / "libs" / "fake-pkg" / "src.py").write_text("VALUE = 2\n")
    (fake_repo / "libs" / "fake-pkg" / "pyproject.toml").write_text(_mk_pyproject("0.1.1"))
    _git(fake_repo, "commit", "-aq", "-m", "change source and bump")

    rc = module.main([f"--base={base}", "--head=HEAD"])

    assert rc == 0


def test_ignores_test_only_changes(fake_repo, monkeypatch):
    """Changes under tests/ don't ship in the wheel and shouldn't require a bump."""
    module = _load_module(monkeypatch, fake_repo)
    monkeypatch.setattr(module, "PACKAGES", ["libs/fake-pkg"])

    pkg_tests = fake_repo / "libs" / "fake-pkg" / "tests"
    pkg_tests.mkdir()
    (pkg_tests / "test_a.py").write_text("def test_x(): pass\n")
    _git(fake_repo, "add", ".")
    _git(fake_repo, "commit", "-q", "-m", "add tests")
    base = _git(fake_repo, "rev-parse", "HEAD~1").strip()

    rc = module.main([f"--base={base}", "--head=HEAD"])

    assert rc == 0


def test_ignores_doc_only_changes(fake_repo, monkeypatch):
    """Changes to README/RST don't ship in the wheel content."""
    module = _load_module(monkeypatch, fake_repo)
    monkeypatch.setattr(module, "PACKAGES", ["libs/fake-pkg"])

    base = _git(fake_repo, "rev-parse", "HEAD").strip()
    (fake_repo / "libs" / "fake-pkg" / "README.md").write_text("# notes\n")
    _git(fake_repo, "add", ".")
    _git(fake_repo, "commit", "-q", "-m", "docs")

    rc = module.main([f"--base={base}", "--head=HEAD"])

    assert rc == 0


def test_skips_new_package_added_on_head(fake_repo, monkeypatch):
    """A package that did not exist at base is skipped (nothing to compare)."""
    module = _load_module(monkeypatch, fake_repo)
    monkeypatch.setattr(module, "PACKAGES", ["libs/fake-pkg", "libs/new-pkg"])

    base = _git(fake_repo, "rev-parse", "HEAD").strip()
    new_pkg = fake_repo / "libs" / "new-pkg"
    new_pkg.mkdir()
    (new_pkg / "pyproject.toml").write_text(_mk_pyproject("0.1.0"))
    (new_pkg / "src.py").write_text("X = 1\n")
    _git(fake_repo, "add", ".")
    _git(fake_repo, "commit", "-q", "-m", "add new package")

    rc = module.main([f"--base={base}", "--head=HEAD"])

    assert rc == 0
