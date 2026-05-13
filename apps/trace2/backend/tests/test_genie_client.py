"""Unit tests for trace2's Genie client.

Most of the file is verbatim from POH; the only behavioural differences
are in ``compose_genie_content`` (trace2 lineage context shape) and
``_space_id`` (TRACE2_GENIE_SPACE_ID fallback chain).  These two are
the focus of the tests — the wire-protocol helpers (start_conversation,
get_message, etc.) are dumb urllib calls already covered by POH's tests.
"""
from __future__ import annotations

import pytest
from shared_api.errors import DomainError as AppError

from trace2_backend.genie_assist.application import genie_client


# ---------------------------------------------------------------------------
# compose_genie_content
# ---------------------------------------------------------------------------


def test_compose_genie_content_includes_focal_and_user_prompt():
    """The composed prompt must surface focal identity + the user question."""
    out = genie_client.compose_genie_content(
        "Where did this batch end up?",
        {
            "mode": "lineage",
            "view": "top-down",
            "focal": {
                "material_id": "MAT-A",
                "batch_id": "B1",
                "plant": "RCN1",
            },
        },
    )
    assert "app: trace2" in out
    assert "mode: lineage" in out
    assert "view: top-down" in out
    assert "focal_material: MAT-A" in out
    assert "focal_batch: B1" in out
    assert "focal_plant: RCN1" in out
    assert "Where did this batch end up?" in out


def test_compose_genie_content_includes_selected_transfer_when_present():
    """``lineage_transfer`` mode adds the selected node's identity + flow."""
    out = genie_client.compose_genie_content(
        "Explain this transfer.",
        {
            "mode": "lineage_transfer",
            "focal": {"material_id": "MAT-A", "batch_id": "B1", "plant": "RCN1"},
            "selected": {
                "material_id": "MAT-X",
                "batch_id": "BX",
                "plant": "RCN2",
                "link": "RECEIPT",
                "side": "upstream",
                "flow_qty": 150,
                "uom": "KG",
            },
        },
    )
    assert "mode: lineage_transfer" in out
    assert "selected_material: MAT-X" in out
    assert "selected_batch: BX" in out
    assert "selected_link: RECEIPT" in out
    assert "selected_side: upstream" in out
    assert "selected_flow_qty: 150" in out
    assert "selected_uom: KG" in out


def test_compose_genie_content_handles_empty_context():
    """A missing page_context must still produce a valid prompt block."""
    out = genie_client.compose_genie_content("Hello?", None)
    assert "app: trace2" in out
    assert "focal_material: none" in out
    assert "selected_material: none" in out
    assert "Hello?" in out


def test_compose_genie_content_treats_zero_flow_qty_as_zero_not_none():
    """A literal 0 flow_qty must render as ``0`` (not ``none``)."""
    out = genie_client.compose_genie_content(
        "Why no flow?",
        {
            "focal": {},
            "selected": {"flow_qty": 0},
        },
    )
    assert "selected_flow_qty: 0" in out


# ---------------------------------------------------------------------------
# _space_id resolution
# ---------------------------------------------------------------------------


def test_space_id_prefers_trace2_specific_var(monkeypatch):
    """TRACE2_GENIE_SPACE_ID wins over the generic GENIE_SPACE_ID."""
    monkeypatch.setenv("TRACE2_GENIE_SPACE_ID", "trace2-space-id")
    monkeypatch.setenv("GENIE_SPACE_ID", "fallback")
    assert genie_client._space_id() == "trace2-space-id"


def test_space_id_falls_back_to_generic(monkeypatch):
    """When only GENIE_SPACE_ID is set, it is used as the trace2 space."""
    monkeypatch.delenv("TRACE2_GENIE_SPACE_ID", raising=False)
    monkeypatch.setenv("GENIE_SPACE_ID", "shared-space")
    assert genie_client._space_id() == "shared-space"


def test_space_id_raises_when_unset(monkeypatch):
    """Missing both variables → 500 with a clear message."""
    monkeypatch.delenv("TRACE2_GENIE_SPACE_ID", raising=False)
    monkeypatch.delenv("GENIE_SPACE_ID", raising=False)
    with pytest.raises(AppError) as exc:
        genie_client._space_id()
    assert exc.value.status_code == 400
    assert "TRACE2_GENIE_SPACE_ID" in str(exc.value.message)


# ---------------------------------------------------------------------------
# Host allowlist (SSRF defence)
# ---------------------------------------------------------------------------


def test_validate_host_rejects_unknown_domain():
    """Hosts outside the workspace allowlist must be refused (SSRF)."""
    with pytest.raises(AppError) as exc:
        genie_client._validate_host("https://attacker.example.com")
    assert exc.value.status_code == 400
    assert "allowlist" in str(exc.value.message).lower()


def test_validate_host_accepts_known_databricks_domain():
    """Standard ``*.cloud.databricks.com`` hosts are accepted."""
    out = genie_client._validate_host("https://workspace.cloud.databricks.com")
    assert out == "https://workspace.cloud.databricks.com"


def test_validate_host_normalises_trailing_slash_and_port():
    """Trailing slashes and ports are stripped to a canonical form."""
    out = genie_client._validate_host("https://workspace.azuredatabricks.net:443/")
    assert out == "https://workspace.azuredatabricks.net"


def test_validate_host_raises_on_empty():
    """Empty host → 500 ``DATABRICKS_HOST is not set``."""
    with pytest.raises(AppError) as exc:
        genie_client._validate_host("")
    assert exc.value.status_code == 400


# ---------------------------------------------------------------------------
# Response normalisation
# ---------------------------------------------------------------------------


def test_normalize_message_extracts_text_and_sql_from_attachments():
    """``answer`` joins attachment text fragments; SQL is surfaced verbatim."""
    out = genie_client.normalize_message(
        {
            "id": "msg-1",
            "conversation_id": "conv-1",
            "status": "COMPLETED",
            "attachments": [
                {
                    "attachment_id": "att-1",
                    "text": "Here are the customers exposed.",
                    "query": {"query": "SELECT * FROM gold_batch_lineage"},
                },
                {"attachment_id": "att-2", "text": "More detail follows."},
            ],
        }
    )
    assert out["messageId"] == "msg-1"
    assert out["conversationId"] == "conv-1"
    assert out["status"] == "COMPLETED"
    assert "Here are the customers exposed." in out["answer"]
    assert "More detail follows." in out["answer"]
    sql_attachments = [a for a in out["attachments"] if a["sql"]]
    assert sql_attachments[0]["sql"] == "SELECT * FROM gold_batch_lineage"


def test_normalize_message_handles_dict_shaped_text():
    """Some attachments wrap ``text`` in ``{content: ...}``; flatten it."""
    out = genie_client.normalize_message(
        {
            "attachments": [
                {"attachment_id": "att-3", "text": {"content": "wrapped text"}},
            ],
        }
    )
    assert "wrapped text" in out["answer"]


def test_normalize_query_result_zips_columns_into_row_dicts():
    """Each row tuple lands keyed by the column names from the manifest."""
    out = genie_client.normalize_query_result(
        {
            "statement_response": {
                "manifest": {"schema": {"columns": [{"name": "plant"}, {"name": "qty"}]}},
                "result": {"data_array": [["RCN1", 100], ["RCN2", 50]]},
            }
        }
    )
    assert out["columns"] == ["plant", "qty"]
    assert out["rows"] == [{"plant": "RCN1", "qty": 100}, {"plant": "RCN2", "qty": 50}]
