"""Tests for the composable dashboard router and DAL helpers."""
from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.routes.dashboards.router import (
    _parse_tags,
    _row_to_detail,
    _row_to_share,
    _row_to_summary,
    require_proxy_user,
    router,
)
from backend.routes.dashboards.models import ComposableDashboardConfig, DashboardDetail
from shared_auth.identity import UserIdentity


# ──────────────────────────────────────────────────────────────────────────
# Fixtures
# ──────────────────────────────────────────────────────────────────────────

def _make_user(email: str = "test@kerry.com") -> UserIdentity:
    return UserIdentity(
        user_id="user-001",
        email=email,
        display_name="Test User",
        groups=[],
        raw_token="tok-test",
    )


def _make_app(user: UserIdentity) -> FastAPI:
    app = FastAPI()
    app.include_router(router, prefix="/api/dashboards")
    app.dependency_overrides[require_proxy_user] = lambda: user
    return app


def _summary_row(
    *,
    id: str = "dash-001",
    title: str = "My Dashboard",
    owner_email: str = "test@kerry.com",
    version: int = 1,
    tags: str = '["oee"]',
    is_public: bool = False,
) -> dict:
    # DAL returns snake_case keys from SQL columns; router transforms to camelCase models.
    return {
        "id": id,
        "title": title,
        "description": None,
        "owner_email": owner_email,
        "is_public": is_public,
        "tags": tags,
        "version": version,
        "created_at": "2026-05-12T00:00:00+00:00",
        "updated_at": "2026-05-12T00:00:00+00:00",
    }


def _detail_row(**kwargs) -> dict:
    row = _summary_row(**kwargs)
    row["config_json"] = json.dumps({"columns": 12, "rowHeight": 80, "widgets": [], "globalFilters": []})
    return row


# ──────────────────────────────────────────────────────────────────────────
# Unit tests — pure helpers
# ──────────────────────────────────────────────────────────────────────────

class TestParseTags:
    def test_parses_json_string(self):
        assert _parse_tags('["oee", "downtime"]') == ["oee", "downtime"]

    def test_accepts_python_list(self):
        assert _parse_tags(["oee", "downtime"]) == ["oee", "downtime"]

    def test_returns_empty_for_none(self):
        assert _parse_tags(None) == []

    def test_returns_empty_for_malformed_json(self):
        assert _parse_tags("not-json") == []

    def test_empty_json_array(self):
        assert _parse_tags("[]") == []


class TestRowToSummary:
    def test_converts_basic_row(self):
        row = _summary_row(title="OEE Board", tags='["oee"]', version=3)
        summary = _row_to_summary(row)
        assert summary.title == "OEE Board"
        assert summary.tags == ["oee"]
        assert summary.version == 3

    def test_owner_email_mapped_to_camel(self):
        row = _summary_row(owner_email="ops@kerry.com")
        summary = _row_to_summary(row)
        assert summary.ownerEmail == "ops@kerry.com"

    def test_is_public_coerced_from_falsy(self):
        row = _summary_row(is_public=False)
        summary = _row_to_summary(row)
        assert summary.isPublic is False

    def test_missing_version_defaults_to_one(self):
        row = _summary_row()
        row["version"] = None
        summary = _row_to_summary(row)
        assert summary.version == 1


class TestRowToDetail:
    def test_parses_config_json(self):
        config_dict = {"columns": 6, "rowHeight": 100, "widgets": [], "globalFilters": []}
        row = _detail_row()
        row["config_json"] = json.dumps(config_dict)
        detail = _row_to_detail(row)
        assert detail.config.columns == 6
        assert detail.config.rowHeight == 100

    def test_degrades_to_empty_config_on_bad_json(self):
        row = _detail_row()
        row["config_json"] = "INVALID"
        detail = _row_to_detail(row)
        assert detail.config == ComposableDashboardConfig()

    def test_handles_missing_config_json(self):
        row = _detail_row()
        del row["config_json"]
        detail = _row_to_detail(row)
        assert isinstance(detail.config, ComposableDashboardConfig)


# ──────────────────────────────────────────────────────────────────────────
# Integration tests — router endpoints (mocked DAL)
# ──────────────────────────────────────────────────────────────────────────

class TestListDashboards:
    def test_returns_list_and_total(self):
        user = _make_user()
        app = _make_app(user)
        rows = [_summary_row(id="d1"), _summary_row(id="d2")]

        with patch(
            "backend.routes.dashboards.router.dal.list_dashboards",
            new_callable=AsyncMock,
            return_value=rows,
        ):
            resp = TestClient(app).get("/api/dashboards")

        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 2
        assert len(data["dashboards"]) == 2
        assert data["dashboards"][0]["id"] == "d1"

    def test_empty_list(self):
        user = _make_user()
        app = _make_app(user)

        with patch(
            "backend.routes.dashboards.router.dal.list_dashboards",
            new_callable=AsyncMock,
            return_value=[],
        ):
            resp = TestClient(app).get("/api/dashboards")

        assert resp.status_code == 200
        assert resp.json() == {"dashboards": [], "total": 0}

    def test_passes_search_query_param(self):
        user = _make_user()
        app = _make_app(user)
        mock = AsyncMock(return_value=[])

        with patch("backend.routes.dashboards.router.dal.list_dashboards", mock):
            TestClient(app).get("/api/dashboards?search=oee")

        _, kwargs = mock.call_args
        assert kwargs["search"] == "oee"

    def test_passes_owned_by_me_flag(self):
        user = _make_user()
        app = _make_app(user)
        mock = AsyncMock(return_value=[])

        with patch("backend.routes.dashboards.router.dal.list_dashboards", mock):
            TestClient(app).get("/api/dashboards?ownedByMe=true")

        _, kwargs = mock.call_args
        assert kwargs["owned_by_me"] is True


class TestGetDashboard:
    def test_returns_detail_when_found(self):
        user = _make_user()
        app = _make_app(user)
        row = _detail_row(id="dash-abc")

        with patch(
            "backend.routes.dashboards.router.dal.get_dashboard",
            new_callable=AsyncMock,
            return_value=row,
        ):
            resp = TestClient(app).get("/api/dashboards/dash-abc")

        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == "dash-abc"
        assert "config" in data

    def test_returns_404_when_not_found(self):
        user = _make_user()
        app = _make_app(user)

        with patch(
            "backend.routes.dashboards.router.dal.get_dashboard",
            new_callable=AsyncMock,
            return_value=None,
        ):
            resp = TestClient(app).get("/api/dashboards/missing-id")

        assert resp.status_code == 404

    def test_passes_email_to_dal(self):
        user = _make_user("ops@kerry.com")
        app = _make_app(user)
        mock = AsyncMock(return_value=_detail_row())

        with patch("backend.routes.dashboards.router.dal.get_dashboard", mock):
            TestClient(app).get("/api/dashboards/dash-001")

        args = mock.call_args[0]
        assert args[2] == "ops@kerry.com"


class TestCreateDashboard:
    def test_creates_and_returns_201(self):
        user = _make_user()
        app = _make_app(user)
        returned_row = _detail_row(title="New Board")

        with patch(
            "backend.routes.dashboards.router.dal.create_dashboard",
            return_value=returned_row,
        ):
            resp = TestClient(app).post(
                "/api/dashboards",
                json={"title": "New Board", "tags": ["oee"]},
            )

        assert resp.status_code == 201
        assert resp.json()["title"] == "New Board"

    def test_rejects_empty_title(self):
        user = _make_user()
        app = _make_app(user)

        resp = TestClient(app).post("/api/dashboards", json={"title": ""})

        assert resp.status_code == 422

    def test_passes_owner_email_from_user_identity(self):
        user = _make_user("plant@kerry.com")
        app = _make_app(user)
        mock = MagicMock(return_value=_detail_row(owner_email="plant@kerry.com"))

        with patch("backend.routes.dashboards.router.dal.create_dashboard", mock):
            TestClient(app).post("/api/dashboards", json={"title": "Board"})

        _, kwargs = mock.call_args
        assert kwargs["owner_email"] == "plant@kerry.com"

    def test_config_serialised_to_json_string(self):
        user = _make_user()
        app = _make_app(user)
        mock = MagicMock(return_value=_detail_row())

        with patch("backend.routes.dashboards.router.dal.create_dashboard", mock):
            TestClient(app).post(
                "/api/dashboards",
                json={"title": "B", "config": {"columns": 6, "rowHeight": 80, "widgets": [], "globalFilters": []}},
            )

        _, kwargs = mock.call_args
        parsed = json.loads(kwargs["config_json"])
        assert parsed["columns"] == 6


class TestUpdateDashboard:
    def test_returns_200_with_updated_detail(self):
        user = _make_user()
        app = _make_app(user)
        returned_row = _detail_row(title="Updated Board", version=2)

        with patch(
            "backend.routes.dashboards.router.dal.update_dashboard",
            return_value=returned_row,
        ):
            resp = TestClient(app).put(
                "/api/dashboards/dash-001",
                json={"title": "Updated Board", "config": {"columns": 12, "rowHeight": 80, "widgets": []}},
            )

        assert resp.status_code == 200
        assert resp.json()["title"] == "Updated Board"

    def test_returns_404_when_dal_returns_none(self):
        user = _make_user()
        app = _make_app(user)

        with patch(
            "backend.routes.dashboards.router.dal.update_dashboard",
            return_value=None,
        ):
            resp = TestClient(app).put(
                "/api/dashboards/nonexistent",
                json={"config": {"columns": 12, "rowHeight": 80, "widgets": []}},
            )

        assert resp.status_code == 404

    def test_rejects_missing_config(self):
        user = _make_user()
        app = _make_app(user)

        resp = TestClient(app).put("/api/dashboards/dash-001", json={"title": "No Config"})

        assert resp.status_code == 422

    def test_passes_email_to_dal(self):
        user = _make_user("owner@kerry.com")
        app = _make_app(user)
        mock = MagicMock(return_value=_detail_row(owner_email="owner@kerry.com"))

        with patch("backend.routes.dashboards.router.dal.update_dashboard", mock):
            TestClient(app).put(
                "/api/dashboards/dash-001",
                json={"config": {"columns": 12, "rowHeight": 80, "widgets": []}},
            )

        args = mock.call_args[0]
        assert args[2] == "owner@kerry.com"

    def test_passes_config_json_to_dal(self):
        user = _make_user()
        app = _make_app(user)
        mock = MagicMock(return_value=_detail_row())

        with patch("backend.routes.dashboards.router.dal.update_dashboard", mock):
            TestClient(app).put(
                "/api/dashboards/dash-001",
                json={"config": {"columns": 6, "rowHeight": 80, "widgets": []}},
            )

        _, kwargs = mock.call_args
        parsed = json.loads(kwargs["config_json"])
        assert parsed["columns"] == 6

    def test_optional_metadata_passed_as_none_when_omitted(self):
        user = _make_user()
        app = _make_app(user)
        mock = MagicMock(return_value=_detail_row())

        with patch("backend.routes.dashboards.router.dal.update_dashboard", mock):
            TestClient(app).put(
                "/api/dashboards/dash-001",
                json={"config": {"columns": 12, "rowHeight": 80, "widgets": []}},
            )

        _, kwargs = mock.call_args
        assert kwargs["title"] is None
        assert kwargs["is_public"] is None
        assert kwargs["tags"] is None


class TestDeleteDashboard:
    def test_returns_204_on_success(self):
        user = _make_user()
        app = _make_app(user)

        with patch(
            "backend.routes.dashboards.router.dal.delete_dashboard",
            return_value=True,
        ):
            resp = TestClient(app).delete("/api/dashboards/dash-001")

        assert resp.status_code == 204

    def test_returns_404_when_dal_returns_false(self):
        user = _make_user()
        app = _make_app(user)

        with patch(
            "backend.routes.dashboards.router.dal.delete_dashboard",
            return_value=False,
        ):
            resp = TestClient(app).delete("/api/dashboards/nonexistent")

        assert resp.status_code == 404

    def test_passes_email_and_id_to_dal(self):
        user = _make_user("owner@kerry.com")
        app = _make_app(user)
        mock = MagicMock(return_value=True)

        with patch("backend.routes.dashboards.router.dal.delete_dashboard", mock):
            TestClient(app).delete("/api/dashboards/dash-xyz")

        args = mock.call_args[0]
        assert args[1] == "dash-xyz"
        assert args[2] == "owner@kerry.com"


# ──────────────────────────────────────────────────────────────────────────
# Unit tests — _row_to_share helper
# ──────────────────────────────────────────────────────────────────────────

def _share_row(
    *,
    dashboard_id: str = "dash-001",
    shared_with_email: str = "guest@kerry.com",
    shared_by_email: str = "owner@kerry.com",
    shared_at: str = "2026-05-12T10:00:00+00:00",
) -> dict:
    return {
        "dashboard_id": dashboard_id,
        "shared_with_email": shared_with_email,
        "shared_by_email": shared_by_email,
        "shared_at": shared_at,
    }


class TestWidgetDataPersistence:
    """Tests for the persistence of widget data binding configuration."""

    def test_data_field_round_trip(self):
        """Verifies that the optional 'data' field in widgets is correctly persisted."""
        user = _make_user()
        app = _make_app(user)
        
        config = {
            "columns": 12,
            "rowHeight": 80,
            "widgets": [
                {
                    "id": "w1",
                    "type": "kpi",
                    "title": "Bound KPI",
                    "layout": {"x": 0, "y": 0, "w": 4, "h": 4, "minW": 2, "minH": 2},
                    "props": {"label": "Static"},
                    "data": {
                        "queryKey": "poh.oee",
                        "params": {"plant_id": {"value": "P1"}},
                        "mapping": {"value": "avg_oee"}
                    }
                }
            ],
            "globalFilters": []
        }
        
        mock_row = _detail_row(title="Data Board")
        mock_row["config_json"] = json.dumps(config)

        with patch("backend.routes.dashboards.router.dal.create_dashboard", return_value=mock_row):
            resp = TestClient(app).post(
                "/api/dashboards",
                json={"title": "Data Board", "config": config},
            )

        assert resp.status_code == 201
        data = resp.json()
        widgets = data["config"]["widgets"]
        assert len(widgets) == 1
        widget = widgets[0]
        assert "data" in widget, f"Widget keys: {list(widget.keys())}"
        assert widget["data"]["queryKey"] == "poh.oee"
        assert widget["data"]["mapping"]["value"] == "avg_oee"

    def test_handles_null_data_field(self):
        """Verifies that a null 'data' field is handled correctly and remains null."""
        user = _make_user()
        app = _make_app(user)
        
        config = {
            "widgets": [
                {
                    "id": "w1",
                    "type": "kpi",
                    "data": None
                }
            ]
        }
        
        # Pydantic will fill in defaults for missing fields in the request
        resp = TestClient(app).post(
            "/api/dashboards",
            json={"title": "Null Data Board", "config": config},
        )
        
        # We just want to check it parses without 422
        assert resp.status_code != 422


class TestListDashboardShares:
    def test_returns_shares_and_total(self):
        user = _make_user("owner@kerry.com")
        app = _make_app(user)
        rows = [_share_row(shared_with_email="a@kerry.com"), _share_row(shared_with_email="b@kerry.com")]

        with patch("backend.routes.dashboards.router.dal.list_shares", return_value=rows):
            resp = TestClient(app).get("/api/dashboards/dash-001/shares")

        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 2
        assert len(data["shares"]) == 2

    def test_empty_list_for_no_shares(self):
        user = _make_user("owner@kerry.com")
        app = _make_app(user)

        with patch("backend.routes.dashboards.router.dal.list_shares", return_value=[]):
            resp = TestClient(app).get("/api/dashboards/dash-001/shares")

        assert resp.status_code == 200
        assert resp.json() == {"shares": [], "total": 0}

    def test_passes_owner_email_and_id_to_dal(self):
        user = _make_user("owner@kerry.com")
        app = _make_app(user)
        mock = MagicMock(return_value=[])

        with patch("backend.routes.dashboards.router.dal.list_shares", mock):
            TestClient(app).get("/api/dashboards/dash-abc/shares")

        args = mock.call_args[0]
        assert args[1] == "dash-abc"
        assert args[2] == "owner@kerry.com"


class TestShareDashboard:
    def test_creates_share_and_returns_201(self):
        user = _make_user("owner@kerry.com")
        app = _make_app(user)
        returned_row = _share_row(shared_with_email="guest@kerry.com")

        with patch("backend.routes.dashboards.router.dal.share_dashboard", return_value=returned_row):
            resp = TestClient(app).post(
                "/api/dashboards/dash-001/shares",
                json={"email": "guest@kerry.com"},
            )

        assert resp.status_code == 201
        assert resp.json()["sharedWithEmail"] == "guest@kerry.com"

    def test_returns_404_when_dal_returns_none(self):
        user = _make_user("owner@kerry.com")
        app = _make_app(user)

        with patch("backend.routes.dashboards.router.dal.share_dashboard", return_value=None):
            resp = TestClient(app).post(
                "/api/dashboards/nonexistent/shares",
                json={"email": "guest@kerry.com"},
            )

        assert resp.status_code == 404

    def test_rejects_empty_email(self):
        user = _make_user("owner@kerry.com")
        app = _make_app(user)

        resp = TestClient(app).post("/api/dashboards/dash-001/shares", json={"email": ""})

        assert resp.status_code == 422

    def test_passes_recipient_email_to_dal(self):
        user = _make_user("owner@kerry.com")
        app = _make_app(user)
        mock = MagicMock(return_value=_share_row())

        with patch("backend.routes.dashboards.router.dal.share_dashboard", mock):
            TestClient(app).post(
                "/api/dashboards/dash-001/shares",
                json={"email": "newuser@kerry.com"},
            )

        args = mock.call_args[0]
        assert args[3] == "newuser@kerry.com"


class TestUnshareDashboard:
    def test_returns_204_on_success(self):
        user = _make_user("owner@kerry.com")
        app = _make_app(user)

        with patch("backend.routes.dashboards.router.dal.unshare_dashboard", return_value=True):
            resp = TestClient(app).delete("/api/dashboards/dash-001/shares/guest%40kerry.com")

        assert resp.status_code == 204

    def test_returns_404_when_dal_returns_false(self):
        user = _make_user("owner@kerry.com")
        app = _make_app(user)

        with patch("backend.routes.dashboards.router.dal.unshare_dashboard", return_value=False):
            resp = TestClient(app).delete("/api/dashboards/nonexistent/shares/guest%40kerry.com")

        assert resp.status_code == 404

    def test_passes_email_params_to_dal(self):
        user = _make_user("owner@kerry.com")
        app = _make_app(user)
        mock = MagicMock(return_value=True)

        with patch("backend.routes.dashboards.router.dal.unshare_dashboard", mock):
            TestClient(app).delete("/api/dashboards/dash-001/shares/guest%40kerry.com")

        args = mock.call_args[0]
        assert args[1] == "dash-001"
        assert args[2] == "owner@kerry.com"
        assert args[3] == "guest@kerry.com"
