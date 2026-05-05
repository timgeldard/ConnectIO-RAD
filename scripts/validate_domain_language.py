#!/usr/bin/env python3
"""
Domain Language Linter.
Validates that domain and application layers use terms consistent with the Glossary.
"""

import ast
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
GLOSSARY_PATH = REPO_ROOT / "docs" / "domain-glossary.md"
DDD_APP_NAMES = ("envmon", "processorderhistory", "spc", "trace2", "warehouse360")

# Terms that are always allowed (technical or standard)
TECHNICAL_WHITELIST = {
    "Entity", "AggregateRoot", "ValueObject", "Repository", "DomainEvent",
    "Request", "Response", "Query", "Command", "Result", "Info", "Detail",
    "List", "Summary", "Error", "Exception", "Base", "Mixin", "Metadata",
    "Config", "Params", "Payload", "Identity", "Id", "Detail", "Header",
    "Build", "Create", "Get", "List", "Fetch", "Update", "Delete", "Upsert",
    "Aggregate", "Derive", "Compute", "Calculate", "Classify", "Detect",
    "Normalize", "Coerce", "Remap", "Convert", "Validate", "Verify",
    "Active", "Open", "Close", "Urgent", "Ready", "Start", "End", "Date", "Time", "Timestamp",
    "Stats", "Delta", "Variance", "Ratio", "Percent", "Pct", "Count", "Sum",
    "Row", "Data", "Content", "Message", "Token", "User", "Client",
    "Mean", "Stddev", "Range", "Percentile", "Rank", "Anova", "Cdf", "Ci", "Rule", "Rules"
}


def extract_glossary_terms() -> set[str]:
    """Extract backticked terms from the domain glossary."""
    if not GLOSSARY_PATH.exists():
        return set()
    
    content = GLOSSARY_PATH.read_text()
    # Find all `Term` patterns
    terms = set(re.findall(r"`([^`]+)`", content))
    # Filter for terms that look like Python identifiers
    return {t for t in terms if re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", t)}


def get_ddd_files() -> list[Path]:
    """Get all domain and application files for DDD apps."""
    files = []
    for app in DDD_APP_NAMES:
        backend_dir = REPO_ROOT / "apps" / app / "backend" / f"{app}_backend"
        if backend_dir.exists():
            files.extend(backend_dir.glob("**/domain/*.py"))
            files.extend(backend_dir.glob("**/application/*.py"))
    return sorted(files)


def lint_file(path: Path, glossary: set[str]) -> list[str]:
    """Check a file for non-glossary terms in class and function names."""
    warnings = []
    try:
        tree = ast.parse(path.read_text())
    except Exception as e:
        return [f"Failed to parse {path}: {e}"]

    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef):
            # Check ClassName
            if not is_term_allowed(node.name, glossary):
                warnings.append(f"Line {node.lineno}: Class '{node.name}' uses non-glossary term")
        
        elif isinstance(node, ast.FunctionDef):
            # Check function_name
            if node.name.startswith("_"):
                continue
            if not is_term_allowed(node.name, glossary):
                # Functions are often multiple words, split and check major parts
                parts = re.split(r"_", node.name.lower())
                # If no part matches a glossary term (case-insensitive), warn
                glossary_lower = {g.lower() for g in glossary}
                if not any(p in glossary_lower or p.capitalize() in glossary or p.upper() in glossary for p in parts):
                    if not any(p in {t.lower() for t in TECHNICAL_WHITELIST} for p in parts):
                        warnings.append(f"Line {node.lineno}: Function '{node.name}' might use non-glossary terms")

    return warnings


def is_term_allowed(name: str, glossary: set[str]) -> bool:
    """Check if a name (PascalCase or snake_case) aligns with glossary or whitelist."""
    if name in TECHNICAL_WHITELIST or name in glossary:
        return True
    
    # Split PascalCase
    parts = re.findall(r'[A-Z]?[a-z]+|[A-Z]+(?=[A-Z][a-z]|\b)', name)
    if not parts: # snake_case
        parts = name.split("_")
        
    parts_lower = {p.lower() for p in parts}
    glossary_lower = {g.lower() for g in glossary}
    whitelist_lower = {t.lower() for t in TECHNICAL_WHITELIST}
    
    # Allowed if any major part of the name is in the glossary or whitelist
    return any(p in glossary_lower or p in whitelist_lower for p in parts_lower)


def main():
    print(f"--- Domain Language Linter ---")
    glossary = extract_glossary_terms()
    print(f"Loaded {len(glossary)} terms from glossary.")
    
    files = get_ddd_files()
    total_warnings = 0
    
    for path in files:
        rel_path = path.relative_to(REPO_ROOT)
        warnings = lint_file(path, glossary)
        if warnings:
            print(f"\n{rel_path}:")
            for w in warnings:
                print(f"  [WARN] {w}")
            total_warnings += len(warnings)
            
    print(f"\nFinished. Total potential language drift issues found: {total_warnings}")
    # We don't exit with non-zero yet as this is a "warning" tool for Phase 2.
    sys.exit(0)


if __name__ == "__main__":
    main()
