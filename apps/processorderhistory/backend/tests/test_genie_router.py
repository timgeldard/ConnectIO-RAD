from fastapi.testclient import TestClient

from backend.main import app
import backend.genie_assist.router_genie as genie_router


client = TestClient(app)


def test_genie_start_composes_context_and_proxies(monkeypatch):
    captured = {}

    monkeypatch.setattr(genie_router, "resolve_genie_token", lambda forwarded, auth: "server-token")

    def fake_start(token, content):
        captured["token"] = token
        captured["content"] = content
        return {
            "conversation": {"id": "conv-1"},
            "message": {"id": "msg-1", "conversation_id": "conv-1", "status": "IN_PROGRESS"},
        }

    monkeypatch.setattr(genie_router, "start_conversation", fake_start)

    response = client.post("/api/genie/start", json={
        "prompt": "What happened?",
        "pageContext": {
            "selected_process_order": "450001",
            "selected_plant": "IE01",
            "active_filters": "detail view for process order 450001",
            "selected_row_count": 1,
        },
    })

    assert response.status_code == 200
    assert response.json()["conversationId"] == "conv-1"
    assert captured["token"] == "server-token"
    assert "- selected_process_order: 450001" in captured["content"]
    assert "User question:\nWhat happened?" in captured["content"]


def test_genie_followup_reuses_conversation(monkeypatch):
    captured = {}

    monkeypatch.setattr(genie_router, "resolve_genie_token", lambda forwarded, auth: "server-token")

    def fake_followup(token, conversation_id, content):
        captured["token"] = token
        captured["conversation_id"] = conversation_id
        captured["content"] = content
        return {"id": "msg-2", "conversation_id": conversation_id, "status": "IN_PROGRESS"}

    monkeypatch.setattr(genie_router, "create_followup", fake_followup)

    response = client.post("/api/genie/followup", json={
        "conversationId": "conv-1",
        "prompt": "And the next one?",
        "pageContext": {"selected_plant": "IE01"},
    })

    assert response.status_code == 200
    assert response.json()["conversationId"] == "conv-1"
    assert response.json()["messageId"] == "msg-2"
    assert captured["conversation_id"] == "conv-1"
    assert "- selected_plant: IE01" in captured["content"]


def test_genie_message_and_query_result_proxy(monkeypatch):
    monkeypatch.setattr(genie_router, "resolve_genie_token", lambda forwarded, auth: "server-token")
    monkeypatch.setattr(genie_router, "get_message", lambda token, cid, mid: {
        "id": mid,
        "conversation_id": cid,
        "status": "COMPLETED",
        "attachments": [{"attachment_id": "att-1", "text": {"content": "Done"}}],
    })
    monkeypatch.setattr(genie_router, "get_query_result", lambda token, cid, mid, aid: {
        "statement_response": {
            "manifest": {"schema": {"columns": [{"name": "order_id"}]}},
            "result": {"data_array": [["1001"]]},
        },
    })

    message = client.get("/api/genie/message?conversationId=conv-1&messageId=msg-1")
    result = client.get("/api/genie/query-result?conversationId=conv-1&messageId=msg-1&attachmentId=att-1")

    assert message.status_code == 200
    assert message.json()["answer"] == "Done"
    assert result.status_code == 200
    assert result.json()["rows"] == [{"order_id": "1001"}]
