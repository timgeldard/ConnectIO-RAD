"""Platform module manifest endpoints.

The frontend keeps a generated JSON manifest so new bounded contexts can
register with the shell without hand-editing routing code. These endpoints
serve that manifest to the runtime shell and expose status/feature-flag data
for dashboards and deployment diagnostics.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import anyio
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/platform/apps", tags=["Platform"])

PLATFORM_ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATHS = (
    PLATFORM_ROOT / "frontend" / "src" / "shell" / "module-manifest.json",
    PLATFORM_ROOT / "static" / "home" / "module-manifest.json",
)
STATIC_ROOT = PLATFORM_ROOT / "static"


def _env_key(flag_name: str) -> str:
    """Return the environment variable name that overrides a feature flag.

    Args:
        flag_name: Manifest feature-flag key such as ``template.enabled``.

    Returns:
        Uppercase environment variable name for deployment overrides.
    """
    normalized = flag_name.upper().replace(".", "_").replace("-", "_")
    return f"PLATFORM_FEATURE_{normalized}"


def _coerce_bool(raw_value: str) -> bool:
    """Parse common boolean-like environment values.

    Args:
        raw_value: Environment variable value to parse.

    Returns:
        ``True`` when the value is a recognized enabled token.
    """
    return raw_value.strip().lower() in {"1", "true", "yes", "on", "enabled"}


def _read_manifest_sync() -> dict[str, Any]:
    """Read the first available platform manifest from dev or built assets.

    Returns:
        Parsed manifest with default top-level fields populated.
    """
    for manifest_path in MANIFEST_PATHS:
        if manifest_path.exists():
            with manifest_path.open(encoding="utf-8") as manifest_file:
                data = json.load(manifest_file)
            if not isinstance(data, dict):
                raise HTTPException(
                    status_code=500,
                    detail="Platform manifest must be a JSON object",
                )
            data.setdefault("version", 1)
            data.setdefault("modules", [])
            data.setdefault("featureFlags", {})
            return data
    raise HTTPException(status_code=404, detail="Platform module manifest not found")


async def _read_manifest() -> dict[str, Any]:
    """Read the module manifest without blocking the FastAPI event loop.

    Returns:
        Parsed manifest with default top-level fields populated.
    """
    return await anyio.to_thread.run_sync(_read_manifest_sync)


def _with_env_feature_flags(manifest: dict[str, Any]) -> dict[str, Any]:
    """Apply deployment-time feature-flag overrides to the manifest payload.

    Args:
        manifest: Parsed platform manifest.

    Returns:
        Manifest copy with effective feature flags merged from environment.
    """
    feature_flags = dict(manifest.get("featureFlags") or {})
    for module in manifest.get("modules", []):
        module_flags = module.get("featureFlags") or {}
        for flag_name, default_value in module_flags.items():
            env_value = os.getenv(_env_key(flag_name))
            feature_flags[flag_name] = (
                _coerce_bool(env_value)
                if env_value is not None
                else bool(default_value)
            )
    return {**manifest, "featureFlags": feature_flags}


def _static_status(module: dict[str, Any]) -> str:
    """Classify whether a registered app has built static assets available.

    Args:
        module: Single module registration from the platform manifest.

    Returns:
        Lightweight availability status for platform dashboard badges.
    """
    route_base = str(
        module.get("routeBase") or module.get("route", {}).get("path") or ""
    )
    slug = route_base.strip("/").split("/", 1)[0]
    if not slug:
        return "unknown"
    if (STATIC_ROOT / slug).exists():
        return "available"
    if module.get("backendPrefix"):
        return "degraded"
    return "missing"


def _module_status(module: dict[str, Any]) -> str:
    """Resolve the effective status for a registered module.

    Args:
        module: Single module registration from the platform manifest.

    Returns:
        Declared status when meaningful, otherwise static asset availability.
    """
    declared_status = module.get("health", {}).get("status")
    if declared_status and declared_status != "unknown":
        return str(declared_status)
    return _static_status(module)


@router.get("/manifest")
async def get_app_manifest() -> dict[str, Any]:
    """Return the dynamic app registration manifest consumed by the shell.

    Returns:
        Platform app manifest with effective feature flags applied.
    """
    return _with_env_feature_flags(await _read_manifest())


@router.get("/feature-flags")
async def get_feature_flags() -> dict[str, bool]:
    """Return app-scoped feature flags after environment overrides.

    Returns:
        Feature flags keyed by manifest flag name.
    """
    manifest = _with_env_feature_flags(await _read_manifest())
    return manifest["featureFlags"]


@router.get("/status")
async def get_app_status() -> dict[str, dict[str, str]]:
    """Return lightweight runtime status keyed by registered module id.

    Returns:
        Module status map used by the platform dashboard.
    """
    manifest = _with_env_feature_flags(await _read_manifest())
    return {
        str(module["moduleId"]): {
            "status": _module_status(module),
            "badge": module.get("health", {}).get("badge") or "Registered",
        }
        for module in manifest.get("modules", [])
        if module.get("moduleId")
    }
