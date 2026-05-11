#!/usr/bin/env python3
"""
ConnectIO-RAD CLI — unified developer workflow tool.

Consolidates validation, auditing, and maintenance scripts into a single
discoverable interface.
"""
import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent


def run(cmd: list[str], cwd: Path = ROOT) -> int:
    """Run a shell command and return its exit code."""
    print(f"Executing: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=cwd)
    return result.returncode


def cmd_check(args):
    """Run all repository health checks."""
    print("--- Running Repository Health Checks ---")
    scripts = [
        ["python3", "scripts/validate_repo_contract.py"],
        ["python3", "scripts/validate_i18n.py"],
        ["python3", "scripts/validate_app_configs.py"],
        ["python3", "scripts/validate_new_app.py", "template"],
        ["uv", "run", "pytest", "scripts/tests/test_ddd_architecture_guardrails.py"],
        ["uv", "run", "interrogate", "."],
        ["npm", "run", "lint"],
    ]
    
    for script in scripts:
        if run(script) != 0:
            print(f"Check failed: {script}")
            sys.exit(1)
    print("All checks passed!")


def cmd_audit(args):
    """Run frontend and i18n audits."""
    if args.type == "frontend":
        sys.exit(run(["node", "scripts/frontend-audit.mjs"] + (["--strict"] if args.strict else [])))
    elif args.type == "i18n":
        sys.exit(run(["python3", "scripts/audit_i18n_literals.py"]))


def cmd_sync(args):
    """Sync dependencies across the monorepo."""
    if run(["uv", "sync"]) != 0:
        sys.exit(1)
    if run(["npm", "install"]) != 0:
        sys.exit(1)
    print("Monorepo synced.")


def cmd_promote(args):
    """Promote a minimal module to full DDD."""
    print(f"--- Promoting Module: {args.name} ---")
    if run(["npx", "nx", "g", "@connectio/rad:promote", f"--name={args.name}"]) != 0:
        sys.exit(1)
    print(f"Module {args.name} promoted successfully.")


def main():
    parser = argparse.ArgumentParser(description="ConnectIO-RAD Unified CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Check
    subparsers.add_parser("check", help="Run all repository health checks")

    # Audit
    audit = subparsers.add_parser("audit", help="Run audits")
    audit.add_argument("type", choices=["frontend", "i18n"], help="Type of audit to run")
    audit.add_argument("--strict", action="store_true", help="Run in strict mode (frontend only)")

    # Sync
    subparsers.add_parser("sync", help="Sync all dependencies (uv + npm)")

    # Promote
    promote = subparsers.add_parser("promote", help="Promote a minimal module to full DDD")
    promote.add_argument("name", help="Name of the module to promote")

    args = parser.parse_args()

    if args.command == "check":
        cmd_check(args)
    elif args.command == "audit":
        cmd_audit(args)
    elif args.command == "sync":
        cmd_sync(args)
    elif args.command == "promote":
        cmd_promote(args)


if __name__ == "__main__":
    main()
