"""Validate a generated ConnectIO-RAD app scaffold."""
from __future__ import annotations

import argparse
import json
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
LOCALES = {
    "da",
    "de",
    "en",
    "es",
    "fr",
    "ga",
    "id",
    "ja",
    "ms",
    "nl",
    "pl",
    "pt",
    "uk",
    "vi",
    "zh-Hans",
    "zh-Hant",
}


def _require(path: Path, errors: list[str]) -> None:
    if not path.exists():
        errors.append(f"Missing required path: {path.relative_to(REPO_ROOT)}")


def validate_app(app_name: str) -> list[str]:
    """
    Validate that a generated application scaffold meets ConnectIO-RAD standards.

    Checks for required directory structure, backend package naming, DDD layers,
    i18n locale coverage, and platform registration.

    Args:
        app_name: The name of the application folder under ``apps/``.

    Returns:
        A list of validation error messages. An empty list means the app is valid.
    """
    app_root = REPO_ROOT / "apps" / app_name
    project_name = app_name.replace("-", "")
    backend_pkg = f"{project_name}_backend"
    errors: list[str] = []

    for path in [
        app_root / "README.md",
        app_root / "databricks.yml",
        app_root / ".ai-dev-kit" / "module-contract.md",
        app_root / "backend" / "project.json",
        app_root / "backend" / "pyproject.toml",
        app_root / "backend" / backend_pkg / "main.py",
        app_root / "frontend" / "project.json",
        app_root / "frontend" / "package.json",
        app_root / "e2e" / "project.json",
    ]:
        _require(path, errors)

    inner_backend = app_root / "backend" / backend_pkg
    context_dirs = [
        path for path in inner_backend.iterdir()
        if path.is_dir() and ((path / "domain").exists() or (path / "application").exists())
    ] if inner_backend.exists() else []
    if not context_dirs:
        errors.append(f"No bounded context found under apps/{app_name}/backend/{backend_pkg}")
    for context in context_dirs:
        for layer in ["domain", "application", "dal", "infrastructure"]:
            _require(context / layer / "__init__.py", errors)
        for path in [
            context / "domain" / "entities.py",
            context / "domain" / "events.py",
            context / "domain" / "value_objects.py",
            context / "application" / "services.py",
            context / "application" / "use_cases.py",
            context / "dal" / "repository.py",
            context / "infrastructure" / "dependencies.py",
            context / "infrastructure" / "settings.py",
            context / "routers" / "router.py",
        ]:
            _require(path, errors)

    locale_root = app_root / "frontend" / "src" / "i18n" / "locales"
    found_locales = {path.stem for path in locale_root.glob("*.json")} if locale_root.exists() else set()
    missing = sorted(LOCALES - found_locales)
    if missing:
        errors.append(f"Missing i18n locale stubs for {app_name}: {', '.join(missing)}")

    manifest_path = REPO_ROOT / "apps" / "platform" / "frontend" / "src" / "shell" / "module-manifest.json"
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text())
        module_ids = {module.get("moduleId") for module in manifest.get("modules", [])}
        if project_name not in module_ids:
            errors.append(f"Platform manifest does not register moduleId '{project_name}'")

    return errors


def main() -> int:
    """CLI entrypoint."""
    parser = argparse.ArgumentParser()
    parser.add_argument("app_name", help="App folder name under apps/")
    args = parser.parse_args()

    errors = validate_app(args.app_name)
    if errors:
        for error in errors:
            print(error)
        return 1
    print(f"apps/{args.app_name} satisfies the generated app scaffold contract.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
