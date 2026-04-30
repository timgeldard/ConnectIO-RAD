"""Databricks Genie Conversation API proxy helpers for Process Order History."""
import json
import os
import time
from typing import Any, Optional
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import HTTPException


TERMINAL_STATUSES = {"COMPLETED", "FAILED", "CANCELLED"}


def compose_genie_content(prompt: str, page_context: Optional[dict[str, Any]]) -> str:
    """Prepend ephemeral UI context to a user prompt.

    Durable business semantics belong in the Genie Space. This helper only sends
    the current screen selection and filters so Genie can answer in context.
    """
    ctx = page_context or {}
    lines = [
        "Application context:",
        "- app: processorderhistory",
        f"- selected_process_order: {ctx.get('selected_process_order') or 'none'}",
        f"- selected_material: {ctx.get('selected_material') or 'none'}",
        f"- selected_plant: {ctx.get('selected_plant') or 'none'}",
        f"- selected_batch: {ctx.get('selected_batch') or 'none'}",
        f"- active_date_range: {ctx.get('active_date_range') or 'none'}",
        f"- active_filters: {ctx.get('active_filters') or 'none'}",
        f"- selected_row_count: {ctx.get('selected_row_count') if ctx.get('selected_row_count') is not None else 'none'}",
        "- user_intent: answer using the current page context unless the user explicitly overrides it",
        "",
        "User question:",
        prompt,
    ]
    return "\n".join(lines)


def _host() -> str:
    host = os.environ.get("DATABRICKS_HOST") or os.environ.get("DATABRICKS_HOSTNAME") or ""
    host = host.rstrip("/")
    if not host:
        raise HTTPException(status_code=500, detail="DATABRICKS_HOST environment variable is not set.")
    if not host.startswith(("http://", "https://")):
        host = f"https://{host}"
    return host


def _space_id() -> str:
    space_id = os.environ.get("GENIE_SPACE_ID", "")
    if not space_id:
        raise HTTPException(status_code=500, detail="GENIE_SPACE_ID environment variable is not set.")
    return space_id


def resolve_genie_token(x_forwarded_access_token: Optional[str], authorization: Optional[str]) -> str:
    """Resolve a Databricks token without exposing it to the frontend."""
    token = x_forwarded_access_token
    if token is None and authorization and authorization.startswith("Bearer "):
        token = authorization[len("Bearer "):]
    if token is None:
        token = os.environ.get("DATABRICKS_TOKEN")
    if not token:
        raise HTTPException(status_code=401, detail="No Databricks access token is available for Genie.")
    return token


def _request_json(
    method: str,
    path: str,
    token: str,
    body: Optional[dict[str, Any]] = None,
    query: Optional[dict[str, str]] = None,
) -> dict[str, Any]:
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
        with urlopen(request, timeout=60) as response:
            raw = response.read()
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace") or exc.reason
        raise HTTPException(status_code=exc.code, detail=f"Genie API error: {detail}") from exc
    except URLError as exc:
        raise HTTPException(status_code=502, detail=f"Unable to reach Databricks Genie API: {exc.reason}") from exc
    return json.loads(raw.decode("utf-8")) if raw else {}


def _conversation_path(suffix: str = "") -> str:
    return f"/api/2.0/genie/spaces/{_space_id()}{suffix}"


def start_conversation(token: str, content: str) -> dict[str, Any]:
    return _request_json("POST", _conversation_path("/start-conversation"), token, {"content": content})


def create_followup(token: str, conversation_id: str, content: str) -> dict[str, Any]:
    path = _conversation_path(f"/conversations/{conversation_id}/messages")
    return _request_json("POST", path, token, {"content": content})


def get_message(token: str, conversation_id: str, message_id: str) -> dict[str, Any]:
    path = _conversation_path(f"/conversations/{conversation_id}/messages/{message_id}")
    return _request_json("GET", path, token)


def get_query_result(
    token: str,
    conversation_id: str,
    message_id: str,
    attachment_id: str,
) -> dict[str, Any]:
    path = _conversation_path(
        f"/conversations/{conversation_id}/messages/{message_id}/attachments/{attachment_id}/query-result"
    )
    return _request_json("GET", path, token)


def wait_for_message(
    token: str,
    conversation_id: str,
    message_id: str,
    *,
    max_attempts: int = 8,
    initial_delay_s: float = 0.5,
) -> dict[str, Any]:
    delay = initial_delay_s
    message = get_message(token, conversation_id, message_id)
    for _ in range(max_attempts):
        if str(message.get("status", "")).upper() in TERMINAL_STATUSES:
            return message
        time.sleep(delay)
        delay = min(delay * 1.5, 4.0)
        message = get_message(token, conversation_id, message_id)
    return message


def _attachment_id(attachment: dict[str, Any]) -> Optional[str]:
    return (
        attachment.get("attachment_id")
        or attachment.get("id")
        or attachment.get("query", {}).get("attachment_id")
        or attachment.get("text", {}).get("attachment_id")
    )


def normalize_message(message: dict[str, Any]) -> dict[str, Any]:
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
        normalized.append({
            "attachmentId": _attachment_id(attachment),
            "text": text,
            "sql": sql,
            "type": attachment.get("type"),
            "query": query,
        })
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
    message = response.get("message") or {}
    normalized = normalize_message(message)
    normalized["conversationId"] = response.get("conversation", {}).get("id") or normalized.get("conversationId")
    return normalized


def normalize_query_result(result: dict[str, Any]) -> dict[str, Any]:
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
