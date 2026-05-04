"""Architecture guardrails for the SPC DDD migration."""

from __future__ import annotations

import ast
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _imports(path: Path) -> list[str]:
    tree = ast.parse(path.read_text(), filename=str(path))
    imports: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imports.extend(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imports.append(node.module)
    return imports


def test_chart_config_router_has_no_direct_sql_runtime_dependency() -> None:
    tree = ast.parse((ROOT / "chart_config" / "router.py").read_text())
    imported_sql_runtime = []
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module == "backend.utils.db":
            imported_sql_runtime.extend(alias.name for alias in node.names if alias.name == "run_sql_async")

    assert imported_sql_runtime == []


def test_chart_config_write_application_enforces_domain_value_objects() -> None:
    imports = _imports(ROOT / "chart_config" / "application" / "commands.py")
    assert "backend.chart_config.domain.locked_limits" in imports
    assert "backend.chart_config.domain.exclusion" in imports


def test_domain_layer_isolation() -> None:
    """Broad sweep — domain must not import infrastructure or framework libraries."""
    forbidden_imports = [
        "fastapi",
        "backend.schemas",
        "backend.utils.db",
        "shared_db",
        "shared_auth",
    ]
    for file_path in ROOT.glob("**/domain/*.py"):
        if file_path.name == "__init__.py":
            continue
        content = file_path.read_text()
        for forbidden in forbidden_imports:
            assert forbidden not in content, (
                f"Forbidden import '{forbidden}' found in {file_path}"
            )


def test_router_layer_isolation() -> None:
    """Routers must stay transport-only — no direct SQL, DAL, or domain imports."""
    for file_path in ROOT.glob("**/router*.py"):
        content = file_path.read_text()
        assert "run_sql_async" not in content, f"Direct SQL execution found in {file_path}"
        assert "tbl(" not in content, f"Table reference found in {file_path}"
        for imported_module in _imports(file_path):
            assert ".dal" not in imported_module, (
                f"Router imports DAL directly in {file_path}: {imported_module}"
            )
            assert ".domain." not in imported_module, (
                f"Router imports domain directly in {file_path}: {imported_module}"
            )


def test_application_layer_isolation() -> None:
    """Application layer must not import FastAPI — keep it transport-agnostic."""
    for file_path in ROOT.glob("**/application/*.py"):
        if file_path.name == "__init__.py":
            continue
        content = file_path.read_text()
        assert "fastapi" not in content, f"FastAPI import found in application service {file_path}"
        assert "APIRouter" not in content, f"APIRouter found in application service {file_path}"
