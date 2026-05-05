"""Architecture guardrails for the POH DDD structure."""

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
            names.extend(alias.asname or alias.name for alias in node.names)
    return names


def _detect_usage_violations(path: Path) -> list[str]:
    """Detect direct usage of forbidden SQL helpers via AST inspection."""
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    violations = []
    forbidden_symbols = {"run_sql_async", "tbl"}
    for node in ast.walk(tree):
        # Check for direct calls: run_sql_async(...) or db.run_sql_async(...)
        if isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name) and node.func.id in forbidden_symbols:
                violations.append(f"direct call to {node.func.id}")
            elif isinstance(node.func, ast.Attribute) and node.func.attr in forbidden_symbols:
                violations.append(f"call to {node.func.attr}")

        # Check for attribute access: db.tbl or obj.tbl
        if isinstance(node, ast.Attribute) and node.attr == "tbl":
            violations.append("attribute access to .tbl")

    return sorted(list(set(violations)))


def test_domain_layer_isolation() -> None:
    """Ensure domain layer does not import infrastructure or framework libraries."""
    forbidden_prefixes = ("fastapi", "backend.schemas", "backend.db", "shared_db", "shared_auth")
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
    forbidden_modules = ("shared_db",)
    for file_path in ROOT.glob("**/router_*.py"):
        modules = _imports(file_path)
        names = _imported_names(file_path)

        # 1. Check module-level forbidden imports
        for module in modules:
            if any(module == m or module.startswith(m + ".") for m in forbidden_modules):
                offenders.append(f"{file_path.relative_to(ROOT)}: forbidden import {module}")
            if ".dal" in module:
                offenders.append(f"{file_path.relative_to(ROOT)}: imports DAL module {module}")

        # 2. Check for forbidden imported names (handles asname)
        if "run_sql_async" in names:
            offenders.append(f"{file_path.relative_to(ROOT)}: imports run_sql_async")
        if "tbl" in names:
            offenders.append(f"{file_path.relative_to(ROOT)}: imports tbl")

        # 3. Check for usage violations (direct calls or attribute access)
        violations = _detect_usage_violations(file_path)
        for v in violations:
            offenders.append(f"{file_path.relative_to(ROOT)}: {v}")

    assert offenders == [], "\n".join(offenders)


def test_application_layer_isolation() -> None:
    """Ensure application layer does not import FastAPI (keep it transport-agnostic)."""
    offenders = []
    for file_path in ROOT.glob("**/application/*.py"):
        if file_path.name == "__init__.py":
            continue
        if "genie_client.py" in str(file_path):
            continue
        modules = _imports(file_path)
        names = _imported_names(file_path)
        for module in modules:
            if module == "fastapi" or module.startswith("fastapi."):
                offenders.append(f"{file_path.relative_to(ROOT)}: imports fastapi ({module})")
        if "APIRouter" in names:
            offenders.append(f"{file_path.relative_to(ROOT)}: imports APIRouter")
    assert offenders == [], "\n".join(offenders)