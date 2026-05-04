import ast
from pathlib import Path


ROOT = Path("apps/processorderhistory/backend")


def _imports(path: Path) -> list[str]:
    tree = ast.parse(path.read_text(), filename=str(path))
    imports: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imports.extend(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imports.append(node.module)
    return imports


def test_domain_layer_isolation():
    """
    Ensure domain layer does not import infrastructure or framework libraries.
    """
    forbidden_imports = [
        "fastapi",
        "backend.schemas",
        "backend.db",
        "shared_db",
        "shared_auth"
    ]
    
    domain_files = list(ROOT.glob("**/domain/*.py"))
    
    for file_path in domain_files:
        content = file_path.read_text()
        for forbidden in forbidden_imports:
            assert forbidden not in content, f"Forbidden import '{forbidden}' found in {file_path}"

def test_router_layer_isolation():
    """
    Ensure routers stay transport-only and route through application services.
    """
    router_files = list(ROOT.glob("**/router_*.py"))
    
    for file_path in router_files:
        content = file_path.read_text()
        assert "run_sql_async" not in content, f"Direct SQL execution found in {file_path}"
        assert "tbl(" not in content, f"Table reference found in {file_path}"
        for imported_module in _imports(file_path):
            assert ".dal" not in imported_module, f"Router imports DAL directly in {file_path}: {imported_module}"

def test_application_layer_isolation():
    """
    Ensure application layer does not import FastAPI (keep it transport-agnostic).
    """
    app_files = list(ROOT.glob("**/application/*.py"))
    
    for file_path in app_files:
        if "genie_client.py" in str(file_path):
            continue
        content = file_path.read_text()
        assert "fastapi" not in content, f"FastAPI import found in application service {file_path}"
        assert "APIRouter" not in content, f"APIRouter found in application service {file_path}"
