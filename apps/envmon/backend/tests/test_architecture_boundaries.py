"""Architecture guardrails for the EnvMon DDD migration."""

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


def test_domain_modules_do_not_depend_on_api_schema_or_infrastructure() -> None:
    forbidden = ("backend.schemas", "backend.utils", "backend.inspection_analysis.dal", "backend.spatial_config.dal")
    offenders = []
    for path in sorted(ROOT.glob("*/domain/*.py")):
        if path.name == "__init__.py":
            continue
        for module in _imports(path):
            if module.startswith(forbidden):
                offenders.append(f"{path.relative_to(ROOT)} imports {module}")

    assert offenders == []


def test_inspection_router_uses_application_services_for_cross_context_reads() -> None:
    router_imports = _imports(ROOT / "inspection_analysis" / "router.py")
    assert "backend.spatial_config.dal" not in router_imports
    assert "backend.spatial_config.application" in router_imports
