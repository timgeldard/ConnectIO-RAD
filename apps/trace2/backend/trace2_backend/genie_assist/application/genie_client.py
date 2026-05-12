"""Databricks Genie Conversation API proxy helpers for trace2.

Mirrors the structure of POH's ``genie_assist/application/genie_client.py``
(see commit message for the duplication rationale and shared-api
extraction plan).  The only material difference is
``compose_genie_content`` — trace2's prompt context is shaped around a
focal batch + an optionally-selected lineage node, not a process-order
list view.
"""
import asyncio
import json
import os
import re
from typing import Any, Optional
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

from fastapi import HTTPException


TERMINAL_STATUSES = {"COMPLETED", "FAILED", "CANCELLED"}

# Hostnames the Genie client is permitted to call. The Databricks Apps proxy
# always sets DATABRICKS_HOST to the workspace URL, so a strict allowlist here
# defends against env-injection or deploy misconfiguration that could redirect
# the client (and the bearer token it carries) to an attacker-controlled host.
#
# Override at deploy time via GENIE_HOST_ALLOWLIST (comma-separated suffixes)
# if a workspace lives on a non-default domain pattern.  Empty values are
# treated as no override.
_DEFAULT_HOST_SUFFIX_ALLOWLIST: tuple[str, ...] = (
    ".azuredatabricks.net",
    ".cloud.databricks.com",
    ".gcp.databricks.com",
)
_HOSTNAME_RE = re.compile(r"^[a-zA-Z0-9.-]+$")


def compose_genie_content(prompt: str, page_context: Optional[dict[str, Any]]) -> str:
    """Prepend ephemeral UI context to a user prompt.

    Durable business semantics belong in the trace2 Genie Space.  This
    helper only sends the current screen selection so Genie can answer
    in context — specifically the focal batch the operator is
    investigating and, when present, the lineage node they
    right-clicked to ask "Explain this transfer".

    Args:
        prompt: Raw user prompt from the frontend.
        page_context: Ephemeral page context extracted from the active screen.

    Returns:
        Prompt content with an application context block followed by the user question.
    """
    ctx = page_context or {}
    focal = ctx.get("focal") or {}
    selected = ctx.get("selected") or {}
    lines = [
        "Application context:",
        "- app: trace2",
        f"- mode: {ctx.get('mode') or 'lineage'}",
        f"- view: {ctx.get('view') or 'none'}",
        f"- focal_material: {focal.get('material_id') or 'none'}",
        f"- focal_batch: {focal.get('batch_id') or 'none'}",
        f"- focal_plant: {focal.get('plant') or 'none'}",
        f"- selected_material: {selected.get('material_id') or 'none'}",
        f"- selected_batch: {selected.get('batch_id') or 'none'}",
        f"- selected_plant: {selected.get('plant') or 'none'}",
        f"- selected_link: {selected.get('link') or 'none'}",
        f"- selected_side: {selected.get('side') or 'none'}",
        f"- selected_flow_qty: {selected.get('flow_qty') if selected.get('flow_qty') is not None else 'none'}",
        f"- selected_uom: {selected.get('uom') or 'none'}",
        "- user_intent: answer using the current page context unless the user explicitly overrides it",
        "",
        "User question:",
        prompt,
    ]
    return "\n".join(lines)


def _allowed_host_suffixes() -> tuple[str, ...]:
    """Return the active host-suffix allowlist (env override or default)."""
    raw = os.environ.get("GENIE_HOST_ALLOWLIST", "").strip()
    if not raw:
        return _DEFAULT_HOST_SUFFIX_ALLOWLIST
    return tuple(s.strip() for s in raw.split(",") if s.strip())


def _validate_host(host: str) -> str:
    """Validate the workspace host before any outbound call.

    The Genie client carries the user's Databricks token; sending it to a
    host not in the workspace allowlist would constitute an SSRF /
    token-exfiltration vector.

    Args:
        host: Hostname or full URL read from DATABRICKS_HOST/DATABRICKS_HOSTNAME.

    Returns:
        The same host normalised to ``https://<host>`` form, with no trailing
        slash, when it passes the allowlist.

    Raises:
        HTTPException: 500 if the host is empty, malformed, or matches no
            allowlisted suffix.
    """
    raw = (host or "").rstrip("/")
    if not raw:
        raise HTTPException(
            status_code=500,
            detail="DATABRICKS_HOST environment variable is not set.",
        )
    if not raw.startswith(("http://", "https://")):
        raw = f"https://{raw}"

    parsed = urlparse(raw)
    hostname = (parsed.hostname or "").lower()
    if not hostname or not _HOSTNAME_RE.match(hostname):
        raise HTTPException(
            status_code=500,
            detail=f"DATABRICKS_HOST is not a valid hostname: {host!r}",
        )

    # `urlparse` defers port validation until `parsed.port` is accessed; an
    # invalid port (non-numeric or out-of-range) raises ValueError at that
    # point, bypassing our HTTPException contract.  Catch and re-raise as the
    # same 500 we use for all other host-validation failures.
    try:
        _ = parsed.port
    except ValueError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"DATABRICKS_HOST has an invalid port: {host!r}",
        ) from exc

    suffixes = _allowed_host_suffixes()
    if not any(hostname.endswith(suffix) for suffix in suffixes):
        raise HTTPException(
            status_code=500,
            detail=(
                "DATABRICKS_HOST is not in the Genie client allowlist. "
                "Refusing to send a Databricks bearer token to an unrecognised host."
            ),
        )

    # Drop the port component entirely — workspace traffic always goes to the
    # default https port and a non-default port on an allowlisted hostname is
    # an unexpected redirect that we should not forward a bearer token to.
    return f"https://{hostname}"


def _host() -> str:
    """Return the configured (and allowlist-validated) Databricks workspace host."""
    raw = os.environ.get("DATABRICKS_HOST") or os.environ.get("DATABRICKS_HOSTNAME") or ""
    return _validate_host(raw)


def _space_id() -> str:
    """Return the configured trace2 Genie Space identifier.

    Returns:
        Genie Space ID from ``TRACE2_GENIE_SPACE_ID`` (preferred) or
        ``GENIE_SPACE_ID`` (fallback, matches POH's variable name when
        a workspace only has one configured space).

    Raises:
        HTTPException: If neither variable is configured.
    """
    space_id = (
        os.environ.get("TRACE2_GENIE_SPACE_ID")
        or os.environ.get("GENIE_SPACE_ID")
        or ""
    )
    if not space_id:
        raise HTTPException(
            status_code=500,
            detail=(
                "TRACE2_GENIE_SPACE_ID (or GENIE_SPACE_ID) environment "
                "variable is not set."
            ),
        )
    return space_id


def resolve_genie_token(
    x_forwarded_access_token: Optional[str],
    authorization: Optional[str],
) -> str:
    """Resolve a Databricks token without exposing it to the frontend."""
    token = x_forwarded_access_token
    if token is None and authorization and authorization.startswith("Bearer "):
        token = authorization[len("Bearer "):]
    if token is None:
        token = os.environ.get("DATABRICKS_TOKEN")
    if not token:
        raise HTTPException(
            status_code=401,
            detail="No Databricks access token is available for Genie.",
        )
    return token


def _request_json(
    method: str,
    path: str,
    token: str,
    body: Optional[dict[str, Any]] = None,
    query: Optional[dict[str, str]] = None,
) -> dict[str, Any]:
    """Send a JSON request to the Databricks Genie API."""
    qs = f"?{urlencode(query)}" if query else ""
    url = f"{_host()}{path}{qs}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    request = Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urlopen(request, timeout=60) as response:  # noqa: S310 — allowlisted host
            raw = response.read()
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace") or exc.reason
        raise HTTPException(status_code=exc.code, detail=f"Genie API error: {detail}") from exc
    except URLError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Unable to reach Databricks Genie API: {exc.reason}",
        ) from exc
    return json.loads(raw.decode("utf-8")) if raw else {}


def _conversation_path(suffix: str = "") -> str:
    """Build a Genie Space conversation API path."""
    return f"/api/2.0/genie/spaces/{_space_id()}{suffix}"


def start_conversation(token: str, content: str) -> dict[str, Any]:
    """Start a Genie conversation."""
    return _request_json(
        "POST", _conversation_path("/start-conversation"), token, {"content": content}
    )


def create_followup(token: str, conversation_id: str, content: str) -> dict[str, Any]:
    """Create a follow-up message in an existing Genie conversation."""
    path = _conversation_path(f"/conversations/{conversation_id}/messages")
    return _request_json("POST", path, token, {"content": content})


def get_message(token: str, conversation_id: str, message_id: str) -> dict[str, Any]:
    """Fetch a Genie conversation message."""
    path = _conversation_path(f"/conversations/{conversation_id}/messages/{message_id}")
    return _request_json("GET", path, token)


def get_query_result(
    token: str,
    conversation_id: str,
    message_id: str,
    attachment_id: str,
) -> dict[str, Any]:
    """Fetch structured query results for a Genie attachment."""
    path = _conversation_path(
        f"/conversations/{conversation_id}/messages/{message_id}"
        f"/attachments/{attachment_id}/query-result"
    )
    return _request_json("GET", path, token)


async def wait_for_message(
    token: str,
    conversation_id: str,
    message_id: str,
    *,
    max_attempts: int = 8,
    initial_delay_s: float = 0.5,
) -> dict[str, Any]:
    """Poll a Genie message until terminal status or attempt cap is hit."""
    delay = initial_delay_s
    message = await asyncio.to_thread(get_message, token, conversation_id, message_id)
    for _ in range(max_attempts):
        if str(message.get("status", "")).upper() in TERMINAL_STATUSES:
            return message
        await asyncio.sleep(delay)
        delay = min(delay * 1.5, 4.0)
        message = await asyncio.to_thread(get_message, token, conversation_id, message_id)
    return message


def _attachment_id(attachment: dict[str, Any]) -> Optional[str]:
    """Extract an attachment ID from known Genie attachment shapes."""
    return (
        attachment.get("attachment_id")
        or attachment.get("id")
        or attachment.get("query", {}).get("attachment_id")
        or attachment.get("text", {}).get("attachment_id")
    )


def normalize_message(message: dict[str, Any]) -> dict[str, Any]:
    """Normalize a raw Genie message for frontend consumption."""
    attachments = message.get("attachments") or []
    normalized = []
    answer_parts = []
    for attachment in attachments:
        text = attachment.get("text")
        if isinstance(text, dict):
            text = text.get("content")
        query = attachment.get("query") or {}
        sql = query.get("query") or query.get("statement") or query.get("sql")
        if text:
            answer_parts.append(str(text))
        normalized.append(
            {
                "attachmentId": _attachment_id(attachment),
                "text": text,
                "sql": sql,
                "type": attachment.get("type"),
                "query": query,
            }
        )
    message_id = message.get("id") or message.get("message_id")
    return {
        "conversationId": message.get("conversation_id") or message.get("conversationId"),
        "messageId": message_id,
        "status": message.get("status"),
        "error": message.get("error"),
        "answer": "\n\n".join(answer_parts),
        "attachments": normalized,
    }


def normalize_start_response(response: dict[str, Any]) -> dict[str, Any]:
    """Normalize the start-conversation response."""
    message = response.get("message") or {}
    normalized = normalize_message(message)
    normalized["conversationId"] = (
        response.get("conversation", {}).get("id") or normalized.get("conversationId")
    )
    return normalized


def normalize_query_result(result: dict[str, Any]) -> dict[str, Any]:
    """Normalize a Genie query-result payload into columns and row objects."""
    statement_response = result.get("statement_response") or result
    manifest = statement_response.get("manifest") or {}
    schema = manifest.get("schema") or {}
    columns = [
        col.get("name") or col.get("column_name") or f"column_{i + 1}"
        for i, col in enumerate(schema.get("columns") or [])
    ]
    data = statement_response.get("result", {}).get("data_array") or result.get("data_array") or []
    rows = [
        {columns[i] if i < len(columns) else f"column_{i + 1}": value for i, value in enumerate(row)}
        for row in data
    ]
    return {
        "columns": columns,
        "rows": rows,
        "raw": result,
    }
