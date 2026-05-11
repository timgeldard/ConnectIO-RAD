import asyncio
import os
import time
from collections.abc import MutableMapping as MutableMappingABC
from dataclasses import dataclass
from typing import Any, Dict, MutableMapping, Tuple
from urllib.parse import urlsplit

import httpx
from openai import AsyncOpenAI

CACHE_KEY = "dbx_oauth"
VALIDATION_TTL_SECONDS = 300


class DatabricksLLMConfigError(RuntimeError):
    """Raised when Databricks LLM configuration is invalid."""


@dataclass(frozen=True)
class DatabricksLLMConfig:
    serving_base_url: str
    workspace_host: str
    model: str
    auth_mode: str


_token_lock = asyncio.Lock()
_token_cache: Dict[str, Any] = {}
_validation_cache: Dict[Tuple[str, str], int] = {}


def _normalize_host(raw_host: str) -> str:
    host = (raw_host or "").strip().rstrip("/")
    if not host:
        raise DatabricksLLMConfigError("Databricks workspace host is empty.")
    if not host.startswith(("http://", "https://")):
        host = "https://" + host
    parts = urlsplit(host)
    if not parts.scheme or not parts.netloc:
        raise DatabricksLLMConfigError(f"Invalid Databricks workspace host: {raw_host!r}")
    return f"{parts.scheme}://{parts.netloc}"


def _normalize_serving_base_url(raw_url: str) -> str:
    value = (raw_url or "").strip()
    if not value:
        raise DatabricksLLMConfigError(
            "DATABRICKS_SERVING_BASE_URL must be set to https://<workspace-host>/serving-endpoints."
        )
    if not value.startswith(("http://", "https://")):
        value = "https://" + value
    parts = urlsplit(value)
    if not parts.scheme or not parts.netloc:
        raise DatabricksLLMConfigError(f"Invalid DATABRICKS_SERVING_BASE_URL: {raw_url!r}")
    path = parts.path.rstrip("/")
    if path != "/serving-endpoints":
        raise DatabricksLLMConfigError(
            "DATABRICKS_SERVING_BASE_URL must end with /serving-endpoints for the target workspace."
        )
    return f"{parts.scheme}://{parts.netloc}/serving-endpoints"


def get_databricks_llm_config() -> DatabricksLLMConfig:
    serving_base_url = _normalize_serving_base_url(
        os.environ.get("DATABRICKS_SERVING_BASE_URL", "")
    )
    workspace_host = serving_base_url[: -len("/serving-endpoints")]

    configured_host = os.environ.get("DATABRICKS_HOST", "").strip()
    if configured_host:
        normalized_host = _normalize_host(configured_host)
        if normalized_host != workspace_host:
            raise DatabricksLLMConfigError(
                "DATABRICKS_HOST must match the workspace host in DATABRICKS_SERVING_BASE_URL."
            )

    model = os.environ.get("DATABRICKS_MODEL", "").strip()
    if not model:
        raise DatabricksLLMConfigError(
            "DATABRICKS_MODEL must be set to a serving endpoint available in the workspace."
        )

    client_id = os.environ.get("DATABRICKS_CLIENT_ID", "").strip()
    client_secret = os.environ.get("DATABRICKS_CLIENT_SECRET", "").strip()
    token = os.environ.get("DATABRICKS_TOKEN", "").strip()

    if client_id and client_secret:
        auth_mode = "oauth-m2m"
    elif token:
        auth_mode = "pat"
    else:
        raise DatabricksLLMConfigError(
            "No Databricks auth configured. Set DATABRICKS_CLIENT_ID and "
            "DATABRICKS_CLIENT_SECRET, or provide DATABRICKS_TOKEN."
        )

    return DatabricksLLMConfig(
        serving_base_url=serving_base_url,
        workspace_host=workspace_host,
        model=model,
        auth_mode=auth_mode,
    )


def _is_token_fresh(cache: MutableMapping[str, Any] | Dict[str, Any]) -> bool:
    return bool(
        cache.get("access_token")
        and int(cache.get("expires_at", 0)) > int(time.time()) + 30
    )


def _write_token_cache(
    access_token: str,
    expires_at: int,
    config: DatabricksLLMConfig,
    cache: MutableMapping[str, Any] | None = None,
) -> None:
    token_record = {
        "access_token": access_token,
        "expires_at": expires_at,
        "workspace_host": config.workspace_host,
        "auth_mode": config.auth_mode,
        "client_id": os.environ.get("DATABRICKS_CLIENT_ID", "").strip(),
    }
    _token_cache.clear()
    _token_cache.update(token_record)
    if cache is not None:
        cache[CACHE_KEY] = dict(token_record)


def _token_cache_matches(
    cache: MutableMapping[str, Any] | Dict[str, Any],
    config: DatabricksLLMConfig,
) -> bool:
    return bool(
        cache.get("workspace_host") == config.workspace_host
        and cache.get("auth_mode") == config.auth_mode
        and cache.get("client_id", "") == os.environ.get("DATABRICKS_CLIENT_ID", "").strip()
    )


async def get_databricks_bearer_token(
    cache: MutableMapping[str, Any] | None = None,
) -> str:
    config = get_databricks_llm_config()

    if config.auth_mode == "pat":
        return os.environ["DATABRICKS_TOKEN"].strip()

    if cache:
        cached = cache.get(CACHE_KEY, {})
        if (
            isinstance(cached, MutableMappingABC)
            and _token_cache_matches(cached, config)
            and _is_token_fresh(cached)
        ):
            _write_token_cache(
                str(cached["access_token"]),
                int(cached["expires_at"]),
                config,
                cache=cache,
            )
            return str(cached["access_token"])

    if _token_cache_matches(_token_cache, config) and _is_token_fresh(_token_cache):
        access_token = str(_token_cache["access_token"])
        expires_at = int(_token_cache["expires_at"])
        _write_token_cache(access_token, expires_at, config, cache=cache)
        return access_token

    async with _token_lock:
        if _token_cache_matches(_token_cache, config) and _is_token_fresh(_token_cache):
            access_token = str(_token_cache["access_token"])
            expires_at = int(_token_cache["expires_at"])
            _write_token_cache(access_token, expires_at, config, cache=cache)
            return access_token

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{config.workspace_host}/oidc/v1/token",
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                    data={"grant_type": "client_credentials", "scope": "all-apis"},
                    auth=(
                        os.environ["DATABRICKS_CLIENT_ID"].strip(),
                        os.environ["DATABRICKS_CLIENT_SECRET"].strip(),
                    ),
                    timeout=30,
                )
            except Exception as exc:
                raise DatabricksLLMConfigError(
                    f"Could not reach Databricks OAuth token endpoint for "
                    f"{config.workspace_host}: {type(exc).__name__}: {str(exc)[:200]}"
                ) from exc
            if response.status_code >= 400:
                raise DatabricksLLMConfigError(
                    f"Failed Databricks OAuth authentication for {config.workspace_host} "
                    f"(HTTP {response.status_code}). Check the service principal credentials "
                    "for that workspace."
                )

            payload = response.json()
            access_token = payload.get("access_token")
            expires_in = int(payload.get("expires_in", 300))
            if not access_token:
                raise DatabricksLLMConfigError(
                    f"Token endpoint response is missing access_token: {payload}"
                )

            expires_at = int(time.time()) + expires_in
            _write_token_cache(str(access_token), expires_at, config, cache=cache)
            return str(access_token)


async def validate_databricks_llm_config(
    cache: MutableMapping[str, Any] | None = None,
) -> DatabricksLLMConfig:
    config = get_databricks_llm_config()
    cache_key = (config.serving_base_url, config.model)

    cached_expiry = _validation_cache.get(cache_key, 0)
    if cached_expiry > int(time.time()):
        return config

    token = await get_databricks_bearer_token(cache=cache)
    headers = {"Authorization": f"Bearer {token}"}
    endpoint_url = f"{config.workspace_host}/api/2.0/serving-endpoints/{config.model}"
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(endpoint_url, headers=headers, timeout=30)
        except Exception as exc:
            raise DatabricksLLMConfigError(
                f"Could not validate DATABRICKS_MODEL={config.model!r} in workspace "
                f"{config.workspace_host}: {type(exc).__name__}: {str(exc)[:200]}"
            ) from exc

        if response.status_code == 404:
            try:
                list_response = await client.get(
                    f"{config.workspace_host}/api/2.0/serving-endpoints",
                    headers=headers,
                    timeout=30,
                )
            except Exception:
                list_response = None
            available: list[str] = []
            if list_response is not None and list_response.status_code < 400:
                try:
                    payload = list_response.json()
                    available = sorted(
                        endpoint.get("name", "").strip()
                        for endpoint in payload.get("endpoints", [])
                        if endpoint.get("name", "").strip()
                    )
                except Exception:
                    available = []
            available_text = ", ".join(available[:10]) if available else "no endpoints were returned"
            raise DatabricksLLMConfigError(
                f"DATABRICKS_MODEL={config.model!r} was not found in workspace "
                f"{config.workspace_host}. Available endpoints include: {available_text}."
            )

        if response.status_code >= 400:
            raise DatabricksLLMConfigError(
                f"Failed to validate DATABRICKS_MODEL={config.model!r} in workspace "
                f"{config.workspace_host} (HTTP {response.status_code}). "
                f"Response: {response.text[:300]}"
            )

    _validation_cache[cache_key] = int(time.time()) + VALIDATION_TTL_SECONDS
    return config


async def build_openai_client(
    *,
    validate: bool = True,
    cache: MutableMapping[str, Any] | None = None,
) -> AsyncOpenAI:
    config = (
        await validate_databricks_llm_config(cache=cache)
        if validate
        else get_databricks_llm_config()
    )
    token = await get_databricks_bearer_token(cache=cache)
    return AsyncOpenAI(api_key=token, base_url=config.serving_base_url)


async def create_foundation_model_client(
    cache: MutableMapping[str, Any] | None = None,
) -> AsyncOpenAI:
    return await build_openai_client(validate=True, cache=cache)


async def resolve_bearer_token(cache: MutableMapping[str, Any] | None = None) -> str:
    return await get_databricks_bearer_token(cache=cache)
