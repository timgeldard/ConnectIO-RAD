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
    """Refuse to start a non-dev process with JWT verification disabled.

    JWT verification is *defence-in-depth*. The Databricks Apps proxy validates
    tokens upstream, but the app must verify signatures itself so a bypass of
    the proxy alone cannot mint acceptable tokens.

    Behaviour:
        * In dev/test mode (``APP_ENV`` in {development, local, test}) — emit a
          warning if JWKS is absent so a developer iterating locally is not
          forced to wire JWKS for every test run.
        * Outside dev/test mode — raise ``RuntimeError`` if both
          ``AUTH_JWKS_URL`` is empty and ``AUTH_ALLOW_UNVERIFIED_JWT`` is not
          enabled. This guards against deploying with neither verification
          configured nor an explicit ack of unsafe behaviour.

    Raises:
        RuntimeError: If running in a non-dev environment with no JWKS URL
            configured and unverified tokens not explicitly allowed.
    """
    jwks_url = os.environ.get("AUTH_JWKS_URL", "").strip()
    if jwks_url:
        return

    if _is_dev_mode():
        logger.warning(
            "AUTH_JWKS_URL is not set. JWT signatures will not be verified. "
            "This is acceptable in dev (APP_ENV=%s).",
            os.environ.get("APP_ENV", "<unset>"),
        )
        return

    if _allow_unverified_tokens():
        raise RuntimeError(
            "AUTH_ALLOW_UNVERIFIED_JWT is set outside dev mode. "
            "JWT signature verification is disabled — unset the variable or "
            "set APP_ENV=development to run without JWKS verification."
        )

    raise RuntimeError(
        "AUTH_JWKS_URL is not configured and AUTH_ALLOW_UNVERIFIED_JWT is not set. "
        "Configure AUTH_JWKS_URL to your workspace OIDC jwks_uri or, for a "
        "deliberately-unsafe deploy, set AUTH_ALLOW_UNVERIFIED_JWT=true."
    )


def _is_dev_mode() -> bool:
    return os.environ.get("APP_ENV", "").lower() in ("development", "local", "test")


def _allow_unverified_tokens() -> bool:
    return os.environ.get("AUTH_ALLOW_UNVERIFIED_JWT", "").strip().lower() in {"1", "true", "yes", "on"}


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
    return _extract_identity(token)


async def require_proxy_user(
    request: Request,
    x_forwarded_access_token: Optional[str] = Header(default=None),
) -> UserIdentity:
    """
    FastAPI dependency to require a valid user identity via Databricks Proxy only.
    
    Strictly enforces x-forwarded-access-token and rejects Authorization headers.
    """
    token = resolve_token(x_forwarded_access_token, None, strict=True)
    return _extract_identity(token)


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
