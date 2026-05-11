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

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/platform/apps", tags=["Platform"])

PLATFORM_ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATHS = (
    PLATFORM_ROOT / "frontend" / "src" / "shell" / "module-manifest.json",
    PLATFORM_ROOT / "static" / "home" / "module-manifest.json",
)
STATIC_ROOT = PLATFORM_ROOT / "static"


def _env_key(flag_name: str) -> str:
    """Return the environment variable name that overrides a feature flag."""
    normalized = flag_name.upper().replace(".", "_").replace("-", "_")
    return f"PLATFORM_FEATURE_{normalized}"


def _coerce_bool(raw_value: str) -> bool:
    """Parse common boolean-like environment values."""
    return raw_value.strip().lower() in {"1", "true", "yes", "on", "enabled"}


def _read_manifest() -> dict[str, Any]:
    """Read the first available platform manifest from dev or built assets."""
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


def _with_env_feature_flags(manifest: dict[str, Any]) -> dict[str, Any]:
    """Apply deployment-time feature-flag overrides to the manifest payload."""
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
    """Classify whether a registered app has built static assets available."""
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


@router.get("/manifest")
async def get_app_manifest() -> dict[str, Any]:
    """Return the dynamic app registration manifest consumed by the shell."""
    return _with_env_feature_flags(_read_manifest())


@router.get("/feature-flags")
async def get_feature_flags() -> dict[str, bool]:
    """Return app-scoped feature flags after environment overrides."""
    manifest = _with_env_feature_flags(_read_manifest())
    return manifest["featureFlags"]


@router.get("/status")
async def get_app_status() -> dict[str, dict[str, str]]:
    """Return lightweight runtime status keyed by registered module id."""
    manifest = _with_env_feature_flags(_read_manifest())
    return {
        str(module["moduleId"]): {
            "status": module.get("health", {}).get("status") or _static_status(module),
            "badge": module.get("health", {}).get("badge") or "Registered",
        }
        for module in manifest.get("modules", [])
        if module.get("moduleId")
    }
