import asyncio
import json
from urllib.error import HTTPError, URLError

import pytest
from fastapi import HTTPException
from shared_manufacturing import test_data

from processorderhistory_backend.genie_assist.application import genie_client


class _FakeResponse:
    def __init__(self, payload: dict):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def read(self):
        return json.dumps(self.payload).encode("utf-8")

    def close(self):
        pass


def test_compose_genie_content_prepends_page_context():
    po_id = test_data.process_order()
    mat_id = test_data.material_id()
    plant = test_data.PLANTS[0]
    b_id = test_data.batch_id()
    content = genie_client.compose_genie_content(
        "Why is this order late?",
        {
            "selected_process_order": po_id,
            "selected_material": mat_id,
            "selected_plant": plant,
            "selected_batch": b_id,
            "active_date_range": "2026-04-01 to 2026-04-30",
            "active_filters": f"plant {plant}, material {mat_id}",
            "selected_row_count": 1,
        },
    )

    assert "- app: processorderhistory" in content
    assert f"- selected_process_order: {po_id}" in content
    assert f"- selected_material: {mat_id}" in content
    assert f"- selected_plant: {plant}" in content
    assert f"- selected_batch: {b_id}" in content
    assert "- active_date_range: 2026-04-01 to 2026-04-30" in content
    assert f"- active_filters: plant {plant}, material {mat_id}" in content
    assert "- selected_row_count: 1" in content
    assert "User question:\nWhy is this order late?" in content


def test_normalize_start_response_handles_genie_message_shape():
    response = {
        "conversation": {"id": "conv-1"},
        "message": {
            "id": "msg-1",
            "conversation_id": "conv-1",
            "status": "COMPLETED",
            "attachments": [
                {"attachment_id": "att-text", "text": {"content": "Here is what happened."}},
                {
                    "attachment_id": "att-query",
                    "query": {"query": "select count(*) from fact_process_order_history"},
                },
            ],
        },
    }

    normalized = genie_client.normalize_start_response(response)

    assert normalized["conversationId"] == "conv-1"
    assert normalized["messageId"] == "msg-1"
    assert normalized["status"] == "COMPLETED"
    assert normalized["answer"] == "Here is what happened."
    assert normalized["attachments"][0]["attachmentId"] == "att-text"
    assert normalized["attachments"][1]["sql"] == "select count(*) from fact_process_order_history"


def test_normalize_message_accepts_alternate_id_names():
    normalized = genie_client.normalize_message({
        "message_id": "msg-2",
        "conversationId": "conv-2",
        "status": "IN_PROGRESS",
    })

    assert normalized["conversationId"] == "conv-2"
    assert normalized["messageId"] == "msg-2"


def test_normalize_query_result_maps_columns_to_rows():
    plant = test_data.PLANTS[0]
    normalized = genie_client.normalize_query_result({
        "statement_response": {
            "manifest": {"schema": {"columns": [{"name": "plant"}, {"name": "orders"}]}},
            "result": {"data_array": [[plant, "12"], ["US01", "8"]]},
        },
    })

    assert normalized["columns"] == ["plant", "orders"]
    assert normalized["rows"] == [
        {"plant": plant, "orders": "12"},
        {"plant": "US01", "orders": "8"},
    ]


def test_resolve_genie_token_keeps_token_server_side(monkeypatch):
    monkeypatch.delenv("DATABRICKS_TOKEN", raising=False)

    assert genie_client.resolve_genie_token("forwarded-token", None) == "forwarded-token"
    assert genie_client.resolve_genie_token(None, "Bearer auth-token") == "auth-token"

    with pytest.raises(HTTPException) as exc:
        genie_client.resolve_genie_token(None, None)
    assert exc.value.status_code == 401


def test_request_json_builds_databricks_request(monkeypatch):
    captured = {}

    monkeypatch.setenv("DATABRICKS_HOST", "adb-test.azuredatabricks.net")

    def fake_urlopen(request, timeout):
        captured["url"] = request.full_url
        captured["headers"] = dict(request.header_items())
        captured["body"] = json.loads(request.data.decode("utf-8"))
        captured["timeout"] = timeout
        return _FakeResponse({"ok": True})

    monkeypatch.setattr(genie_client, "urlopen", fake_urlopen)

    result = genie_client._request_json(
        "POST",
        "/api/test",
        "token-1",
        {"content": "hello"},
        {"a": "b"},
    )

    assert result == {"ok": True}
    assert captured["url"] == "https://adb-test.azuredatabricks.net/api/test?a=b"
    assert captured["headers"]["Authorization"] == "Bearer token-1"
    assert captured["body"] == {"content": "hello"}
    assert captured["timeout"] == 60


def test_request_json_surfaces_http_errors(monkeypatch):
    monkeypatch.setenv("DATABRICKS_HOST", "https://adb-test.azuredatabricks.net")

    def fake_urlopen(request, timeout):
        raise HTTPError(
            request.full_url,
            403,
            "Forbidden",
            {},
            _FakeResponse({"message": "denied"}),
        )

    monkeypatch.setattr(genie_client, "urlopen", fake_urlopen)

    with pytest.raises(HTTPException) as exc:
        genie_client._request_json("GET", "/api/test", "token-1")

    assert exc.value.status_code == 403
    assert "Genie API error" in exc.value.detail


def test_request_json_surfaces_url_errors(monkeypatch):
    monkeypatch.setenv("DATABRICKS_HOST", "https://adb-test.azuredatabricks.net")
    monkeypatch.setattr(genie_client, "urlopen", lambda request, timeout: (_ for _ in ()).throw(URLError("offline")))

    with pytest.raises(HTTPException) as exc:
        genie_client._request_json("GET", "/api/test", "token-1")

    assert exc.value.status_code == 502
    assert "Unable to reach Databricks Genie API" in exc.value.detail


def test_host_rejected_when_unset(monkeypatch):
    """Empty DATABRICKS_HOST raises 500 — the client refuses to send a token to nowhere."""
    monkeypatch.delenv("DATABRICKS_HOST", raising=False)
    monkeypatch.delenv("DATABRICKS_HOSTNAME", raising=False)
    with pytest.raises(HTTPException) as exc:
        genie_client._host()
    assert exc.value.status_code == 500
    assert "DATABRICKS_HOST" in exc.value.detail


def test_host_rejected_when_outside_allowlist(monkeypatch):
    """Hosts not matching the workspace suffix allowlist are blocked, with no
    outbound HTTP call made — defends against env-injection / SSRF redirecting
    the user's bearer token to an attacker host."""
    monkeypatch.setenv("DATABRICKS_HOST", "attacker.com")
    monkeypatch.delenv("GENIE_HOST_ALLOWLIST", raising=False)
    with pytest.raises(HTTPException) as exc:
        genie_client._host()
    assert exc.value.status_code == 500
    assert "allowlist" in exc.value.detail.lower()


def test_host_rejected_when_invalid_characters(monkeypatch):
    """Malformed hostnames are rejected before any URL parsing trickery can apply."""
    monkeypatch.setenv("DATABRICKS_HOST", "https://attacker.com#.azuredatabricks.net")
    with pytest.raises(HTTPException) as exc:
        genie_client._host()
    assert exc.value.status_code == 500


def test_host_accepts_default_workspace_pattern(monkeypatch):
    """A real Azure Databricks workspace hostname passes the default allowlist."""
    monkeypatch.setenv("DATABRICKS_HOST", "adb-1234567890123456.7.azuredatabricks.net")
    assert genie_client._host() == "https://adb-1234567890123456.7.azuredatabricks.net"


def test_host_accepts_aws_workspace_pattern(monkeypatch):
    """AWS Databricks workspaces (`*.cloud.databricks.com`) also pass the default."""
    monkeypatch.setenv("DATABRICKS_HOST", "https://example.cloud.databricks.com")
    assert genie_client._host() == "https://example.cloud.databricks.com"


def test_host_allowlist_override_via_env(monkeypatch):
    """GENIE_HOST_ALLOWLIST env var replaces the default suffix list, allowing
    deploys against unusual workspace domains without code changes."""
    monkeypatch.setenv("DATABRICKS_HOST", "internal.example.corp")
    monkeypatch.setenv("GENIE_HOST_ALLOWLIST", ".example.corp")
    assert genie_client._host() == "https://internal.example.corp"


def test_host_allowlist_override_still_blocks_other_hosts(monkeypatch):
    """An explicit allowlist override doesn't widen — non-matching hosts still rejected."""
    monkeypatch.setenv("DATABRICKS_HOST", "attacker.example.com")
    monkeypatch.setenv("GENIE_HOST_ALLOWLIST", ".example.corp")
    with pytest.raises(HTTPException) as exc:
        genie_client._host()
    assert exc.value.status_code == 500


def test_conversation_helpers_use_expected_paths(monkeypatch):
    calls = []

    def fake_request(method, path, token, body=None, query=None):
        calls.append((method, path, token, body, query))
        return {"id": "ok"}

    monkeypatch.setenv("GENIE_SPACE_ID", "space-1")
    monkeypatch.setattr(genie_client, "_request_json", fake_request)

    genie_client.start_conversation("token", "hello")
    genie_client.create_followup("token", "conv-1", "next")
    genie_client.get_message("token", "conv-1", "msg-1")
    genie_client.get_query_result("token", "conv-1", "msg-1", "att-1")

    assert calls == [
        ("POST", "/api/2.0/genie/spaces/space-1/start-conversation", "token", {"content": "hello"}, None),
        ("POST", "/api/2.0/genie/spaces/space-1/conversations/conv-1/messages", "token", {"content": "next"}, None),
        ("GET", "/api/2.0/genie/spaces/space-1/conversations/conv-1/messages/msg-1", "token", None, None),
        (
            "GET",
            "/api/2.0/genie/spaces/space-1/conversations/conv-1/messages/msg-1/attachments/att-1/query-result",
            "token",
            None,
            None,
        ),
    ]


def test_wait_for_message_polls_with_async_sleep(monkeypatch):
    calls = []
    responses = iter([
        {"status": "IN_PROGRESS"},
        {"status": "IN_PROGRESS"},
        {"status": "COMPLETED", "id": "msg-1"},
    ])

    def fake_get_message(token, conversation_id, message_id):
        calls.append((token, conversation_id, message_id))
        return next(responses)

    async def fake_sleep(delay):
        calls.append(("sleep", delay))

    monkeypatch.setattr(genie_client, "get_message", fake_get_message)
    monkeypatch.setattr(genie_client.asyncio, "sleep", fake_sleep)

    result = asyncio.run(genie_client.wait_for_message(
        "token",
        "conv-1",
        "msg-1",
        max_attempts=4,
        initial_delay_s=0.1,
    ))

    assert result == {"status": "COMPLETED", "id": "msg-1"}
    assert calls == [
        ("token", "conv-1", "msg-1"),
        ("sleep", 0.1),
        ("token", "conv-1", "msg-1"),
        ("sleep", 0.15000000000000002),
        ("token", "conv-1", "msg-1"),
    ]
