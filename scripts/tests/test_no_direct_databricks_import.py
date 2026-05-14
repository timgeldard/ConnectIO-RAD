"""Defence-in-depth guard: no direct ``databricks`` imports outside shared-db.

Complements the importlinter contract ``databricks-sql-only-via-shared-db``
with a fast AST-based scan that runs without an installed environment.  Any
violation here should be fixed by routing the call through ``shared_db``
(``run_sql_async``, ``tbl``, etc.).

Temporary exemptions for Slice 1D migration targets are listed in
``_SLICE_1D_EXEMPTIONS`` and will be removed when those files are migrated.
"""

from __future__ import annotations

import ast
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]

_APP_BACKENDS = [
    REPO_ROOT / "apps" / name / "backend"
    for name in (
        "connectedquality",
        "envmon",
        "processorderhistory",
        "spc",
        "template",
        "trace2",
        "warehouse360",
    )
]
_SHARED_LIBS = [
    REPO_ROOT / "libs" / name / "src"
    for name in (
        "shared-auth",
        "shared-ddd",
        "shared-geo",
        "shared-manufacturing",
        "shared-reporting",
        "shared-trace",
    )
]

# Relative paths (from REPO_ROOT) of files temporarily exempted while their
# Databricks SQL logic migrates to shared_db in Slice 1D.
_SLICE_1D_EXEMPTIONS: frozenset[Path] = frozenset(
    [
        Path("apps/spc/backend/spc_backend/utils/db.py"),
        Path("apps/envmon/backend/envmon_backend/utils/db.py"),
    ]
)


def _python_files(root: Path) -> list[Path]:
    if not root.exists():
        return []
    return list(root.rglob("*.py"))


def _imports_databricks(path: Path) -> bool:
    """Return True if the file contains any top-level or nested databricks import."""
    try:
        tree = ast.parse(path.read_text(encoding="utf-8"))
    except SyntaxError:
        return False
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            if any(alias.name == "databricks" or alias.name.startswith("databricks.") for alias in node.names):
                return True
        elif isinstance(node, ast.ImportFrom):
            if node.module and (node.module == "databricks" or node.module.startswith("databricks.")):
                return True
    return False


def _scan_roots(roots: list[Path]) -> list[Path]:
    violations: list[Path] = []
    for root in roots:
        for py_file in _python_files(root):
            rel = py_file.relative_to(REPO_ROOT)
            if rel in _SLICE_1D_EXEMPTIONS:
                continue
            if _imports_databricks(py_file):
                violations.append(rel)
    return violations


def test_no_direct_databricks_imports_in_app_backends():
    """App backends must not import databricks directly; use shared_db instead."""
    violations = _scan_roots(_APP_BACKENDS)
    assert violations == [], (
        "Direct 'databricks' imports found outside shared-db.\n"
        "Route all Databricks SQL calls through shared_db (run_sql_async, tbl, …).\n"
        "Violations:\n" + "\n".join(f"  {v}" for v in violations)
    )


def test_no_direct_databricks_imports_in_shared_libs():
    """Shared libraries (other than shared-db) must not import databricks directly."""
    violations = _scan_roots(_SHARED_LIBS)
    assert violations == [], (
        "Direct 'databricks' imports found in shared libraries.\n"
        "Route all Databricks SQL calls through shared_db.\n"
        "Violations:\n" + "\n".join(f"  {v}" for v in violations)
    )
