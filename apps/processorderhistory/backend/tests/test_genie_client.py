import pytest
from fastapi import HTTPException

from backend import genie_client


def test_compose_genie_content_prepends_page_context():
    content = genie_client.compose_genie_content(
        "Why is this order late?",
        {
            "selected_process_order": "100123",
            "selected_material": "MAT-9",
            "selected_plant": "IE01",
            "selected_batch": "B-7",
            "active_date_range": "2026-04-01 to 2026-04-30",
            "active_filters": "plant IE01, material MAT-9",
            "selected_row_count": 1,
        },
    )

    assert "- app: processorderhistory" in content
    assert "- selected_process_order: 100123" in content
    assert "- selected_material: MAT-9" in content
    assert "- selected_plant: IE01" in content
    assert "- selected_batch: B-7" in content
    assert "- active_date_range: 2026-04-01 to 2026-04-30" in content
    assert "- active_filters: plant IE01, material MAT-9" in content
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
    normalized = genie_client.normalize_query_result({
        "statement_response": {
            "manifest": {"schema": {"columns": [{"name": "plant"}, {"name": "orders"}]}},
            "result": {"data_array": [["IE01", "12"], ["US01", "8"]]},
        },
    })

    assert normalized["columns"] == ["plant", "orders"]
    assert normalized["rows"] == [
        {"plant": "IE01", "orders": "12"},
        {"plant": "US01", "orders": "8"},
    ]


def test_resolve_genie_token_keeps_token_server_side(monkeypatch):
    monkeypatch.delenv("DATABRICKS_TOKEN", raising=False)

    assert genie_client.resolve_genie_token("forwarded-token", None) == "forwarded-token"
    assert genie_client.resolve_genie_token(None, "Bearer auth-token") == "auth-token"

    with pytest.raises(HTTPException) as exc:
        genie_client.resolve_genie_token(None, None)
    assert exc.value.status_code == 401
