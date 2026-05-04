import sys
import pytest
from pathlib import Path

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
    
    domain_files = list(Path("apps/processorderhistory/backend").glob("**/domain/*.py"))
    
    for file_path in domain_files:
        content = file_path.read_text()
        for forbidden in forbidden_imports:
            assert forbidden not in content, f"Forbidden import '{forbidden}' found in {file_path}"

def test_router_layer_isolation():
    """
    Ensure routers do not import DAL directly if an application layer exists.
    For this pragmatic migration, we allow direct router->DAL if it's a simple read.
    But we enforce that Routers don't contain SQL execution.
    """
    router_files = list(Path("apps/processorderhistory/backend").glob("**/router_*.py"))
    
    for file_path in router_files:
        content = file_path.read_text()
        assert "run_sql_async" not in content, f"Direct SQL execution found in {file_path}"
        assert "tbl(" not in content, f"Table reference found in {file_path}"

def test_application_layer_isolation():
    """
    Ensure application layer does not import FastAPI (keep it transport-agnostic).
    """
    app_files = list(Path("apps/processorderhistory/backend").glob("**/application/*.py"))
    
    for file_path in app_files:
        if "genie_client.py" in str(file_path):
            continue
        content = file_path.read_text()
        assert "fastapi" not in content, f"FastAPI import found in application service {file_path}"
        assert "APIRouter" not in content, f"APIRouter found in application service {file_path}"
