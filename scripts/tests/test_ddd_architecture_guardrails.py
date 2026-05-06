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
    Path("apps/processorderhistory/backend/processorderhistory_backend/genie_assist/application/genie_client.py"),
}

ALLOWED_CONTEXTS = {
    "envmon": {"inspection_analysis", "spatial_config"},
    "processorderhistory": {"order_execution", "manufacturing_analytics", "production_planning", "genie_assist"},
    "spc": {"chart_config", "process_control"},
    "trace2": {"batch_trace", "lineage_analysis", "quality_record"},
    "warehouse360": {"inventory_management", "dispensary_ops", "order_fulfillment", "operations_control_tower"},
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
    return sorted(path for app_name, backend in zip(DDD_APP_NAMES, APP_BACKENDS) for path in (backend / f"{app_name}_backend").glob("**/domain/*.py"))


def _application_files() -> list[Path]:
    return sorted(path for app_name, backend in zip(DDD_APP_NAMES, APP_BACKENDS) for path in (backend / f"{app_name}_backend").glob("**/application/*.py"))


def _router_files() -> list[Path]:
    return sorted(path for app_name, backend in zip(DDD_APP_NAMES, APP_BACKENDS) for path in (backend / f"{app_name}_backend").glob("router*.py"))


def test_domain_modules_do_not_import_transport_application_or_infrastructure() -> None:
    offenders: list[str] = []
    for path in _domain_files():
        if path.name == "__init__.py":
            continue
        
        # Determine the current context of this domain file
        # Path: apps/<app>/backend/<app_backend>/<context>/domain/<file>.py
        parts = path.relative_to(REPO_ROOT).parts
        current_app = parts[1]
        current_context = parts[4]

        for module in _imports(path):
            if module.startswith(DOMAIN_FORBIDDEN_PREFIXES) or any(part in module for part in DOMAIN_FORBIDDEN_PARTS):
                offenders.append(f"{path.relative_to(REPO_ROOT)} imports {module}")
            
            # Sibling domain import rule
            if ".domain" in module:
                module_parts = module.split(".")
                if len(module_parts) >= 2:
                    target_context = module_parts[1]
                    if target_context != current_context and target_context in ALLOWED_CONTEXTS.get(current_app, {}):
                        offenders.append(f"{path.relative_to(REPO_ROOT)} imports sibling domain {module}")

    assert offenders == []


def test_no_unauthorized_bounded_contexts() -> None:
    """Verify that no new bounded contexts have been added without approval."""
    unauthorized: list[str] = []
    for app_name, backend_path in zip(DDD_APP_NAMES, APP_BACKENDS):
        inner_backend = backend_path / f"{app_name}_backend"
        
        # Contexts are directories inside the inner backend that have a domain/ or application/ folder
        actual_contexts = set()
        if inner_backend.exists():
            for d in inner_backend.iterdir():
                if d.is_dir() and ((d / "domain").exists() or (d / "application").exists()):
                    actual_contexts.add(d.name)
        
        allowed = ALLOWED_CONTEXTS.get(app_name, set())
        for context in actual_contexts:
            if context not in allowed:
                unauthorized.append(f"App '{app_name}' has unauthorized context '{context}'")
                
    assert unauthorized == []


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
