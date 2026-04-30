"""Backend proxy for Databricks Genie Conversation API."""
from typing import Any, Optional

from fastapi import APIRouter, Header, Query
from pydantic import BaseModel, Field

from backend.genie_client import (
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

router = APIRouter()


class GenieRequest(BaseModel):
    prompt: str = Field(min_length=1)
    page_context: dict[str, Any] = Field(default_factory=dict, alias="pageContext")


class GenieFollowupRequest(GenieRequest):
    conversation_id: str = Field(alias="conversationId")


@router.post("/genie/start")
async def genie_start(
    body: GenieRequest,
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    token = resolve_genie_token(x_forwarded_access_token, authorization)
    content = compose_genie_content(body.prompt, body.page_context)
    return normalize_start_response(start_conversation(token, content))


@router.post("/genie/followup")
async def genie_followup(
    body: GenieFollowupRequest,
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    token = resolve_genie_token(x_forwarded_access_token, authorization)
    content = compose_genie_content(body.prompt, body.page_context)
    response = create_followup(token, body.conversation_id, content)
    return normalize_start_response({"conversation": {"id": body.conversation_id}, "message": response})


@router.get("/genie/message")
async def genie_message(
    conversation_id: str = Query(alias="conversationId"),
    message_id: str = Query(alias="messageId"),
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    token = resolve_genie_token(x_forwarded_access_token, authorization)
    return normalize_message(get_message(token, conversation_id, message_id))


@router.get("/genie/query-result")
async def genie_query_result(
    conversation_id: str = Query(alias="conversationId"),
    message_id: str = Query(alias="messageId"),
    attachment_id: str = Query(alias="attachmentId"),
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    token = resolve_genie_token(x_forwarded_access_token, authorization)
    result = get_query_result(token, conversation_id, message_id, attachment_id)
    return normalize_query_result(result)
