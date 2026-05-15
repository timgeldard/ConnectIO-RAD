"""Governance guard: DAL files must not import databricks or private shared_db names.

Scans all ``dal/`` directories under the app backends and checks that:

1. No file imports ``databricks`` directly (should go through ``shared_db``).
2. No file imports private names from ``shared_db`` — i.e. names matching
   ``shared_db._*`` — which are implementation details of the library, not
   part of its public contract.
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


def _dal_files(backend_root: Path) -> list[Path]:
    if not backend_root.exists():
        return []
    return list(backend_root.rglob("dal/*.py"))


def _violations(path: Path) -> list[str]:
    """Return a list of violation descriptions for the given file."""
    try:
        tree = ast.parse(path.read_text(encoding="utf-8"))
    except SyntaxError:
        return []

    found: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name == "databricks" or alias.name.startswith("databricks."):
                    found.append(f"direct databricks import: {alias.name}")
        elif isinstance(node, ast.ImportFrom):
            module = node.module or ""
            if module == "databricks" or module.startswith("databricks."):
                found.append(f"direct databricks import: from {module}")
            if module == "shared_db" or module.startswith("shared_db."):
                for alias in node.names:
                    if alias.name.startswith("_"):
                        found.append(f"private shared_db name: from {module} import {alias.name}")
    return found


def test_dal_files_use_no_direct_databricks_or_private_shared_db():
    """DAL files must route SQL through shared_db's public API only."""
    all_violations: list[str] = []
    for backend in _APP_BACKENDS:
        for dal_file in _dal_files(backend):
            rel = dal_file.relative_to(REPO_ROOT)
            for desc in _violations(dal_file):
                all_violations.append(f"  {rel}: {desc}")

    assert all_violations == [], (
        "DAL files must not import databricks directly or use private shared_db names.\n"
        "Use shared_db public API (run_sql_async, tbl, sql_param, …).\n"
        "Violations:\n" + "\n".join(all_violations)
    )
