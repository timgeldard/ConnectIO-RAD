"""Architecture guardrails for the W360 DDD structure."""

from __future__ import annotations

import ast
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _imports(path: Path) -> list[str]:
    """Return imported module names from a Python source file (AST-based)."""
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    modules: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            modules.extend(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            modules.append(node.module)
    return modules


def _imported_names(path: Path) -> list[str]:
    """Return symbol names from all import statements in a Python source file."""
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    names: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            names.extend(alias.asname or alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            names.extend(alias.name for alias in node.names)
    return names


def test_domain_layer_isolation() -> None:
    """Ensure domain layer does not import infrastructure or framework libraries."""
    forbidden_prefixes = ("fastapi", "backend.schemas", "backend.utils.db", "shared_db", "shared_auth")
    offenders = []
    for file_path in ROOT.glob("**/domain/*.py"):
        if file_path.name == "__init__.py":
            continue
        for module in _imports(file_path):
            if any(module == p or module.startswith(p + ".") for p in forbidden_prefixes):
                offenders.append(f"{file_path.relative_to(ROOT)} imports {module}")
    assert offenders == [], "\n".join(offenders)


def test_router_layer_isolation() -> None:
    """Ensure routers stay transport-only and route through application services."""
    offenders = []
    for file_path in ROOT.glob("**/router_*.py"):
        modules = _imports(file_path)
        names = _imported_names(file_path)
        if "run_sql_async" in names:
            offenders.append(f"{file_path.relative_to(ROOT)}: imports run_sql_async directly")
        if "tbl" in names:
            offenders.append(f"{file_path.relative_to(ROOT)}: imports tbl directly")
        for module in modules:
            if ".dal" in module:
                offenders.append(f"{file_path.relative_to(ROOT)}: imports DAL module {module}")
    assert offenders == [], "\n".join(offenders)


def test_application_layer_isolation() -> None:
    """Ensure application layer does not import FastAPI (keep it transport-agnostic)."""
    offenders = []
    for file_path in ROOT.glob("**/application/*.py"):
        if file_path.name == "__init__.py":
            continue
        modules = _imports(file_path)
        names = _imported_names(file_path)
        for module in modules:
            if module == "fastapi" or module.startswith("fastapi."):
                offenders.append(f"{file_path.relative_to(ROOT)}: imports fastapi ({module})")
        if "APIRouter" in names:
            offenders.append(f"{file_path.relative_to(ROOT)}: imports APIRouter")
    assert offenders == [], "\n".join(offenders)