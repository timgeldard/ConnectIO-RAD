"""Backend proxy for Databricks Genie Conversation API."""
from typing import Annotated, Any, Optional

from anyio.to_thread import run_sync
from fastapi import APIRouter, Header, Query
from pydantic import BaseModel, ConfigDict, Field

from processorderhistory_backend.genie_assist.application.genie_client import (
    compose_genie_content,
    create_followup,
    get_message,
    get_query_result,
    normalize_message,
    normalize_query_result,
    normalize_start_response,
    resolve_genie_token,
    start_conversation,
)
from processorderhistory_backend.utils.rate_limit import limiter

router = APIRouter()


class GenieRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    prompt: Annotated[str, Field(min_length=1)]
    page_context: Annotated[dict[str, Any], Field(alias="pageContext")] = {}


class GenieFollowupRequest(GenieRequest):
    conversation_id: Annotated[str, Field(alias="conversationId")]


@router.post("/genie/start")
@limiter.limit("20/minute")
async def genie_start(
    body: GenieRequest,
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Start a new Genie conversation and return the initial message status."""
    token = resolve_genie_token(x_forwarded_access_token, authorization)
    content = compose_genie_content(body.prompt, body.page_context)
    response = await run_sync(start_conversation, token, content)
    return normalize_start_response(response)


@router.post("/genie/followup")
@limiter.limit("20/minute")
async def genie_followup(
    body: GenieFollowupRequest,
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Post a follow-up prompt to an existing Genie conversation."""
    token = resolve_genie_token(x_forwarded_access_token, authorization)
    content = compose_genie_content(body.prompt, body.page_context)
    response = await run_sync(create_followup, token, body.conversation_id, content)
    return normalize_start_response({"conversation": {"id": body.conversation_id}, "message": response})


@router.get("/genie/message")
@limiter.limit("60/minute")
async def genie_message(
    conversation_id: str = Query(alias="conversationId"),
    message_id: str = Query(alias="messageId"),
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Poll for the status and content of a Genie message."""
    token = resolve_genie_token(x_forwarded_access_token, authorization)
    response = await run_sync(get_message, token, conversation_id, message_id)
    return normalize_message(response)


@router.get("/genie/query-result")
@limiter.limit("60/minute")
async def genie_query_result(
    conversation_id: str = Query(alias="conversationId"),
    message_id: str = Query(alias="messageId"),
    attachment_id: str = Query(alias="attachmentId"),
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Fetch tabular query results attached to a Genie message."""
    token = resolve_genie_token(x_forwarded_access_token, authorization)
    result = await run_sync(get_query_result, token, conversation_id, message_id, attachment_id)
    return normalize_query_result(result)
