from __future__ import annotations

import logging
import os
from functools import lru_cache
from dataclasses import dataclass, field
from typing import Any, Optional

import jwt
from jwt import PyJWKClient
from fastapi import Header, HTTPException, Request

logger = logging.getLogger(__name__)


def _extract_bearer_token(authorization: Optional[str]) -> str | None:
    """Extract a Bearer token from an Authorization header value.

    Args:
        authorization: Raw ``Authorization`` header value.

    Returns:
        The bearer token when the header is well formed, otherwise ``None``.
    """
    candidate = (authorization or "").strip()
    if not candidate:
        return None
    scheme, _, token = candidate.partition(" ")
    if scheme.lower() != "bearer":
        return None
    token = token.strip()
    return token or None


@dataclass(frozen=True)
class UserIdentity:
    """
    Standardized user identity extracted from the access token.
    """
    user_id: str
    email: Optional[str] = None
    display_name: Optional[str] = None
    groups: list[str] = field(default_factory=list)
    raw_token: str = field(repr=False, default="")

    @property
    def is_authenticated(self) -> bool:
        return bool(self.user_id)


def resolve_token(
    x_forwarded_access_token: Optional[str],
    authorization: Optional[str] = None,
    strict: bool = True,
) -> str:
    """Resolve the access token from request headers.

    The Databricks Apps proxy sets ``x-forwarded-access-token`` on every
    legitimate request. The ``Authorization: Bearer`` header is an *alternate*
    auth path that bypasses the proxy entirely; allowing it in production
    means the proxy is no longer the only source of identity.

    From 2026-05-07 onwards, ``strict=True`` is the default and the Bearer
    fallback is honoured *only* when the caller explicitly opts in
    (``strict=False``) AND ``APP_ENV`` is ``development``, ``local``, or
    ``test``. In any other environment the fallback is ignored and a
    structured warning is logged once per request so operators can see
    callers that still expect the old behaviour.

    Args:
        x_forwarded_access_token: Token forwarded by the Databricks Apps
            proxy. The canonical, always-trusted source in production.
        authorization: Optional ``Authorization`` header value. Only used
            in dev mode and only when ``strict=False`` is explicitly passed.
        strict: When True (default), only the proxy header is accepted.
            Passing False is an explicit dev-mode opt-in; production
            continues to enforce strict mode regardless.

    Returns:
        The resolved access token.

    Raises:
        HTTPException: 401 if no token is present in the accepted headers.
    """
    token = x_forwarded_access_token

    bearer_allowed = (not strict) and _is_dev_mode()
    bearer_token = _extract_bearer_token(authorization)
    if (
        bearer_allowed
        and token is None
        and bearer_token is not None
    ):
        token = bearer_token
    elif not strict and not _is_dev_mode():
        # Caller asked for non-strict but we're in production — refuse the
        # fallback. Log so operators can find the caller and migrate it.
        logger.warning(
            "resolve_token called with strict=False outside dev mode; "
            "Bearer fallback ignored. APP_ENV=%s",
            os.environ.get("APP_ENV", "<unset>"),
        )

    if not token:
        raise HTTPException(
            status_code=401,
            detail="No access token present. Expected x-forwarded-access-token header.",
        )

    return token


def warn_if_jwks_unconfigured() -> None:
    """Warn when local JWT verification is not fully configured.

    Databricks Apps authenticates users at the proxy and forwards both a user
    access token and identity headers to the app. The app still keeps optional
    JWKS support for diagnostics and non-proxy deployments, but normal
    Databricks Apps requests should not fail startup just because local JWT
    verification is absent or incomplete.

    Behaviour:
        * ``AUTH_JWKS_URL`` absent — warn and continue.
        * ``AUTH_JWKS_URL`` present but ``AUTH_JWT_AUDIENCE`` absent outside
          dev/test — warn and continue, because forwarded-header identity does
          not require audience validation.
    """
    jwks_url = os.environ.get("AUTH_JWKS_URL", "").strip()
    if jwks_url:
        if not _is_dev_mode() and not os.environ.get("AUTH_JWT_AUDIENCE", "").strip():
            logger.warning(
                "AUTH_JWKS_URL is set without AUTH_JWT_AUDIENCE. Local JWT "
                "verification is not audience-pinned; Databricks Apps proxy "
                "headers remain the primary identity source."
            )
        return

    logger.warning(
        "AUTH_JWKS_URL is not set. Local JWT signatures will not be verified; "
        "Databricks Apps proxy headers remain the primary identity source. "
        "APP_ENV=%s",
        os.environ.get("APP_ENV", "<unset>"),
    )


def _is_dev_mode() -> bool:
    return os.environ.get("APP_ENV", "").lower() in ("development", "local", "test")


def _allow_unverified_tokens() -> bool:
    return os.environ.get("AUTH_ALLOW_UNVERIFIED_JWT", "").strip().lower() in {"1", "true", "yes", "on"}


def _require_audience_for_verified_tokens() -> None:
    """Require an expected JWT audience outside local development.

    Raises:
        RuntimeError: If JWKS verification is enabled in a non-dev environment
            without an expected audience value.
    """
    if _is_dev_mode():
        return
    if os.environ.get("AUTH_JWT_AUDIENCE", "").strip():
        return
    raise RuntimeError(
        "AUTH_JWT_AUDIENCE is required when AUTH_JWKS_URL is configured outside "
        "dev mode. Set it to the expected Databricks workspace/application "
        "audience so tokens minted for other tenants are rejected."
    )


def _jwt_verification_config() -> tuple[str, str | None, str | None]:
    return (
        os.environ.get("AUTH_JWKS_URL", "").strip(),
        os.environ.get("AUTH_JWT_AUDIENCE", "").strip() or None,
        os.environ.get("AUTH_JWT_ISSUER", "").strip() or None,
    )


@lru_cache(maxsize=4)
def _jwk_client(jwks_url: str) -> PyJWKClient:
    return PyJWKClient(jwks_url)


async def require_user(
    request: Request,
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
) -> UserIdentity:
    """FastAPI dependency that accepts either proxy or Bearer auth in dev.

    In production this is *equivalent to* :func:`require_proxy_user` — the
    Bearer-token fallback is dev-mode only (see :func:`resolve_token`). New
    routes should prefer :func:`require_proxy_user` directly so the strict
    contract is visible at the call site; this function exists so the
    handful of debug-only endpoints that genuinely benefit from a Bearer
    fallback during local iteration can keep working without spelling out
    the conditional themselves.
    """
    token = resolve_token(x_forwarded_access_token, authorization, strict=False)
    return _extract_identity_from_request(request, token)


async def require_proxy_user(
    request: Request,
    x_forwarded_access_token: Optional[str] = Header(default=None),
) -> UserIdentity:
    """
    FastAPI dependency to require a valid user identity via Databricks Proxy only.
    
    Strictly enforces x-forwarded-access-token and rejects Authorization headers.
    """
    token = resolve_token(x_forwarded_access_token, None, strict=True)
    return _extract_identity_from_request(request, token)


def _header_value(request: Request, name: str) -> str | None:
    value = request.headers.get(name)
    if value is None:
        return None
    value = value.strip()
    return value or None


def _extract_identity_from_request(request: Request, token: str) -> UserIdentity:
    """Build identity from Databricks Apps forwarded headers.

    Databricks Apps forwards identity separately from the access token. The
    token is still retained for downstream Databricks SQL/API calls, but local
    JWKS verification is not required to identify the user behind the proxy.
    """
    forwarded_user = _header_value(request, "x-forwarded-user")
    email = _header_value(request, "x-forwarded-email")
    preferred_username = _header_value(request, "x-forwarded-preferred-username")

    if forwarded_user or email or preferred_username:
        display_name = preferred_username
        return UserIdentity(
            user_id=forwarded_user or email or preferred_username or "unknown",
            email=email or (
                preferred_username if preferred_username and "@" in preferred_username else None
            ),
            display_name=display_name,
            raw_token=token,
        )

    if _is_dev_mode() or _allow_unverified_tokens():
        return _extract_identity(token)

    logger.warning("proxy_identity_headers_missing")
    return UserIdentity(user_id="unknown", raw_token=token)


def _extract_identity(token: str) -> UserIdentity:
    """
    Internal helper to extract identity from a verified token.

    Local/test environments may explicitly use unsigned decoding for developer
    ergonomics. Production deployments must configure JWKS validation.
    """
    payload = _decode_token(token)
    email = (
        payload.get("email")
        or payload.get("upn")
        or payload.get("unique_name")
        or payload.get("preferred_username")
    )
    return UserIdentity(
        user_id=payload.get("sub") or email or "unknown",
        email=email,
        display_name=payload.get("name") or payload.get("given_name"),
        groups=payload.get("groups") or [],
        raw_token=token,
    )


def _decode_token(token: str) -> dict[str, Any]:
    """Decode and optionally verify a JWT.

    Verification order:
      1. If ``AUTH_JWKS_URL`` is set, attempt full JWKS signature + issuer
         verification. On success the decoded payload is returned immediately.
      2. If JWKS verification fails **and** ``AUTH_ALLOW_UNVERIFIED_JWT`` is
         ``true``, a warning is logged and execution falls through to step 3.
         This is the recommended UAT escape hatch when the JWKS endpoint is
         temporarily unreachable or the signing-key configuration is being
         diagnosed — it keeps auth working without disabling JWT parsing.
      3. Without a JWKS URL (or after a permitted JWKS fallback), perform an
         unverified signature decode that still validates the token format and
         standard time-based claims (``exp``, ``nbf``).  Requires either dev
         mode or ``AUTH_ALLOW_UNVERIFIED_JWT=true``.

    Args:
        token: Raw access token forwarded by the Databricks Apps proxy.

    Returns:
        Decoded JWT payload as a plain dict.

    Raises:
        HTTPException: 401 if the token is invalid or verification is required
            and fails.  500 if JWKS is not configured and unverified decoding
            is not explicitly permitted.
    """
    jwks_url, audience, issuer = _jwt_verification_config()
    if jwks_url:
        _require_audience_for_verified_tokens()
        try:
            signing_key = _jwk_client(jwks_url).get_signing_key_from_jwt(token)
            options = {"verify_aud": audience is not None}
            return jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256", "RS384", "RS512", "ES256", "ES384", "ES512"],
                audience=audience,
                issuer=issuer,
                options=options,
                leeway=30,
            )
        except Exception as exc:
            if _allow_unverified_tokens():
                logger.warning(
                    "JWKS verification failed (%s); AUTH_ALLOW_UNVERIFIED_JWT is set "
                    "so falling through to unverified decode. Fix AUTH_JWKS_URL or "
                    "AUTH_JWT_ISSUER to restore full verification.",
                    exc,
                )
            else:
                raise HTTPException(status_code=401, detail="Invalid access token.") from exc

    if not (_is_dev_mode() or _allow_unverified_tokens()):
        raise HTTPException(
            status_code=500,
            detail="JWT verification is not configured. Set AUTH_JWKS_URL for production.",
        )

    try:
        return jwt.decode(token, options={"verify_signature": False})
    except Exception as exc:
        if _is_dev_mode():
            return {"sub": "dev-user"}
        raise HTTPException(status_code=401, detail="Invalid token format.") from exc
