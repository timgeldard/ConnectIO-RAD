"""Architecture guardrails for the SPC DDD migration."""

from __future__ import annotations

import ast
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _imports(path: Path) -> list[str]:
    """
    Return imported module names from a Python source file (AST-based).

    Args:
        path: Path to the Python source file.

    Returns:
        A list of fully qualified module names imported in the file.
    """
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    modules: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            modules.extend(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            modules.append(node.module)
    return modules


def _imported_names(path: Path) -> list[str]:
    """
    Return symbol names from all import statements in a Python source file.

    Collects both the original name and any alias (asname) for each imported symbol.

    Args:
        path: Path to the Python source file.

    Returns:
        A list of symbol names (both original and aliased) imported in the file.
    """
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    names: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            for alias in node.names:
                names.append(alias.name)
                if alias.asname:
                    names.append(alias.asname)
    return names


def _detect_usage_violations(path: Path) -> list[str]:
    """
    Detect direct usage of forbidden SQL helpers via AST inspection.

    Scans the AST for direct calls to forbidden symbols (e.g., run_sql_async)
    or attribute access to forbidden members (e.g., .tbl).

    Args:
        path: Path to the Python source file.

    Returns:
        A sorted list of unique violation descriptions found in the file.
    """
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


def test_chart_config_router_has_no_direct_sql_runtime_dependency() -> None:
    """
    Ensure the chart config router does not import SQL execution helpers.

    The router should not have direct dependencies on low-level database
    utilities.
    """
    tree = ast.parse((ROOT / "chart_config" / "router.py").read_text())
    imported_sql_runtime = []
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module == "backend.utils.db":
            imported_sql_runtime.extend(alias.name for alias in node.names if alias.name == "run_sql_async")

    assert imported_sql_runtime == []


def test_chart_config_write_application_enforces_domain_value_objects() -> None:
    """
    Ensure application commands depend on domain-level value objects.

    Application services should use domain concepts rather than primitive
    types for business logic operations.
    """
    imports = _imports(ROOT / "chart_config" / "application" / "commands.py")
    assert "backend.chart_config.domain.locked_limits" in imports
    assert "backend.chart_config.domain.exclusion" in imports


def test_domain_layer_isolation() -> None:
    """
    Broad sweep — domain must not import infrastructure or framework libraries.

    Enforces that domain modules stay focused on business logic and do not leak
    implementation details from the transport or database layers.
    """
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
    """
    Routers must stay transport-only — no direct SQL, DAL, or domain imports.

    Ensures that routers only handle request/response mapping and delegate
    business logic to the application layer.
    """
    offenders = []
    forbidden_modules = ("shared_db",)
    for file_path in ROOT.glob("**/router*.py"):
        modules = _imports(file_path)
        names = _imported_names(file_path)

        # 1. Check module-level forbidden imports
        for module in modules:
            if any(module == m or module.startswith(m + ".") for m in forbidden_modules):
                offenders.append(f"{file_path.relative_to(ROOT)}: forbidden import {module}")
            if re.search(r"(^|\.)dal($|\.)", module):
                offenders.append(f"{file_path.relative_to(ROOT)}: imports DAL module {module}")
            if re.search(r"(^|\.)domain($|\.)", module):
                offenders.append(f"{file_path.relative_to(ROOT)}: imports domain module {module}")

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
    """
    Application layer must not import FastAPI — keep it transport-agnostic.

    Ensures that application services can be reused outside of a web context.
    """
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
