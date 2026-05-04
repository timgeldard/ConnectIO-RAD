"""Repository-wide DDD architecture guardrails."""

from __future__ import annotations

import ast
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
DDD_APP_NAMES = ("envmon", "processorderhistory", "spc", "trace2", "warehouse360")
APP_BACKENDS = [REPO_ROOT / "apps" / app_name / "backend" for app_name in DDD_APP_NAMES]

DOMAIN_FORBIDDEN_PREFIXES = (
    "fastapi",
    "shared_auth",
    "shared_db",
)
DOMAIN_FORBIDDEN_PARTS = (
    ".application",
    ".dal",
    ".router",
    ".schemas",
    ".db",
    ".utils.db",
)
APPLICATION_FORBIDDEN_PREFIXES = ("fastapi",)
ROUTER_FORBIDDEN_PARTS = (".dal",)
ROUTER_FORBIDDEN_NAMES = ("run_sql_async", "tbl", "silver_tbl")
APPLICATION_TRANSPORT_EXCEPTIONS = {
    Path("apps/processorderhistory/backend/genie_assist/application/genie_client.py"),
}


def _imports(path: Path) -> list[str]:
    tree = ast.parse(path.read_text(), filename=str(path))
    imports: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imports.extend(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imports.append(node.module)
    return imports


def _imported_names(path: Path) -> list[str]:
    tree = ast.parse(path.read_text(), filename=str(path))
    names: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            names.extend(alias.asname or alias.name.rsplit(".", maxsplit=1)[-1] for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            names.extend(alias.asname or alias.name for alias in node.names)
    return names


def _domain_files() -> list[Path]:
    return sorted(path for backend in APP_BACKENDS for path in backend.glob("**/domain/*.py"))


def _application_files() -> list[Path]:
    return sorted(path for backend in APP_BACKENDS for path in backend.glob("**/application/*.py"))


def _router_files() -> list[Path]:
    return sorted(path for backend in APP_BACKENDS for path in backend.glob("**/router*.py"))


def test_domain_modules_do_not_import_transport_application_or_infrastructure() -> None:
    offenders: list[str] = []
    for path in _domain_files():
        if path.name == "__init__.py":
            continue
        for module in _imports(path):
            if module.startswith(DOMAIN_FORBIDDEN_PREFIXES) or any(part in module for part in DOMAIN_FORBIDDEN_PARTS):
                offenders.append(f"{path.relative_to(REPO_ROOT)} imports {module}")

    assert offenders == []


def test_application_services_remain_transport_agnostic() -> None:
    offenders: list[str] = []
    for path in _application_files():
        if path.relative_to(REPO_ROOT) in APPLICATION_TRANSPORT_EXCEPTIONS:
            continue
        for module in _imports(path):
            if module.startswith(APPLICATION_FORBIDDEN_PREFIXES):
                offenders.append(f"{path.relative_to(REPO_ROOT)} imports {module}")

    assert offenders == []


def test_routers_do_not_reach_into_dal_or_sql_runtime() -> None:
    offenders: list[str] = []
    for path in _router_files():
        imports = _imports(path)
        imported_names = _imported_names(path)
        for module in imports:
            if any(part in module for part in ROUTER_FORBIDDEN_PARTS):
                offenders.append(f"{path.relative_to(REPO_ROOT)} imports {module}")
        for name in ROUTER_FORBIDDEN_NAMES:
            if name in imported_names:
                offenders.append(f"{path.relative_to(REPO_ROOT)} imports {name}")

    assert offenders == []
