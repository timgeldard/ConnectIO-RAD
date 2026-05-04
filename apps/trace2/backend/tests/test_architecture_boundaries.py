"""Tests to enforce domain, application, and router boundaries for Trace2."""

from pathlib import Path

def test_domain_layer_isolation():
    """
    Ensure domain layer does not import infrastructure or framework libraries.
    """
    forbidden_imports = [
        "fastapi",
        "backend.schemas",
        "backend.utils.db",
        "shared_db",
        "shared_auth"
    ]
    
    # We check the file contents directly to ensure no static imports exist
    from pathlib import Path
    domain_files = list(Path("apps/trace2/backend").glob("**/domain/*.py"))
    
    for file_path in domain_files:
        content = file_path.read_text()
        for forbidden in forbidden_imports:
            assert forbidden not in content, f"Forbidden import '{forbidden}' found in {file_path}"

def test_router_layer_isolation():
    """
    Ensure routers do not import DAL directly (they should use application services).
    Exceptions allowed for the shim router.
    """
    router_files = list(Path("apps/trace2/backend").glob("**/router.py"))
    
    for file_path in router_files:
        content = file_path.read_text()
        # Should not import TraceCoreDal or generic DAL shims
        assert "shared_trace.dal" not in content, f"Direct library DAL import found in {file_path}"
        assert "backend.dal.trace_dal" not in content, f"Direct shim DAL import found in {file_path}"
        assert "run_sql_async" not in content, f"Direct SQL execution found in {file_path}"

def test_application_layer_isolation():
    """
    Ensure application layer does not import FastAPI (keep it transport-agnostic).
    """
    from pathlib import Path
    app_files = list(Path("apps/trace2/backend").glob("**/application/*.py"))
    
    for file_path in app_files:
        content = file_path.read_text()
        assert "fastapi" not in content, f"FastAPI import found in application service {file_path}"
        assert "APIRouter" not in content, f"APIRouter found in application service {file_path}"
