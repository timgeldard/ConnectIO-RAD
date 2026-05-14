"""Tests for layout_publish application service — pure-Python mocks."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest

from envmon_backend.spatial_config.application.layout_publish import (
    get_draft_layout,
    get_or_create_draft,
    get_published_layout,
    publish_layout,
    rollback_layout,
)
from envmon_backend.spatial_config.application.layout_validation import (
    ValidationIssue,
    ValidationResult,
)
from envmon_backend.spatial_config.domain.revision import LayoutRevision


# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

_DRAFT_ROW = {
    "revision_id": "rev-draft",
    "plant_id": "P225",
    "floor_id": "F1",
    "revision_number": 2,
    "state": "draft",
    "base_revision_id": "rev-001",
    "change_reason": None,
    "created_by": "tim@example.com",
    "created_at": datetime(2026, 5, 14, 9, 0, 0, tzinfo=timezone.utc),
    "published_by": None,
    "published_at": None,
    "rolled_back_from_revision_id": None,
}

_PUBLISHED_ROW = {**_DRAFT_ROW, "revision_id": "rev-001", "revision_number": 1, "state": "published"}

_CLEAN_VALIDATION = ValidationResult(issues=[])

_BLOCKING_VALIDATION = ValidationResult(issues=[
    ValidationIssue(severity="blocking_error", code="L5_NO_PARENT_ZONE",
                    message="No parent zone", subject_id="LOC-001"),
])


# ---------------------------------------------------------------------------
# get_or_create_draft
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_get_or_create_draft_returns_existing_draft():
    with patch("envmon_backend.spatial_config.application.layout_publish.fetch_draft_revision",
               new=AsyncMock(return_value=[_DRAFT_ROW])):
        result = await get_or_create_draft("token", "P225", "F1", "tim@example.com")
    assert isinstance(result, LayoutRevision)
    assert result.revision_id == "rev-draft"
    assert result.state == "draft"


@pytest.mark.anyio
async def test_get_or_create_draft_creates_when_none_exists():
    with patch("envmon_backend.spatial_config.application.layout_publish.fetch_draft_revision",
               new=AsyncMock(side_effect=[[], [_DRAFT_ROW]])), \
         patch("envmon_backend.spatial_config.application.layout_publish.fetch_revisions",
               new=AsyncMock(return_value=[_PUBLISHED_ROW])), \
         patch("envmon_backend.spatial_config.application.layout_publish.fetch_active_revision",
               new=AsyncMock(return_value=[_PUBLISHED_ROW])), \
         patch("envmon_backend.spatial_config.application.layout_publish.create_revision",
               new=AsyncMock(return_value=None)):
        result = await get_or_create_draft("token", "P225", "F1", "tim@example.com")
    assert isinstance(result, LayoutRevision)


# ---------------------------------------------------------------------------
# publish_layout — guard checks
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_publish_without_reason_raises():
    with pytest.raises(ValueError, match="PUBLISH_NO_REASON"):
        await publish_layout("token", "P225", "F1", "rev-draft", "", "tim@example.com")


@pytest.mark.anyio
async def test_publish_without_reason_whitespace_raises():
    with pytest.raises(ValueError, match="PUBLISH_NO_REASON"):
        await publish_layout("token", "P225", "F1", "rev-draft", "   ", "tim@example.com")


@pytest.mark.anyio
async def test_publish_with_no_draft_raises():
    with patch("envmon_backend.spatial_config.application.layout_publish.fetch_draft_revision",
               new=AsyncMock(return_value=[])):
        with pytest.raises(ValueError, match="PUBLISH_NO_DRAFT"):
            await publish_layout("token", "P225", "F1", "rev-draft", "Added zones", "tim@example.com")


@pytest.mark.anyio
async def test_publish_with_blocking_errors_raises():
    with patch("envmon_backend.spatial_config.application.layout_publish.fetch_draft_revision",
               new=AsyncMock(return_value=[_DRAFT_ROW])), \
         patch("envmon_backend.spatial_config.application.layout_publish.validate_draft_layout",
               new=AsyncMock(return_value=_BLOCKING_VALIDATION)):
        with pytest.raises(ValueError, match="blocking error"):
            await publish_layout("token", "P225", "F1", "rev-draft", "Added zones", "tim@example.com")


# ---------------------------------------------------------------------------
# publish_layout — success path
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_publish_success_calls_supersede_and_updates_floor():
    published_row = {**_DRAFT_ROW, "state": "published"}
    supersede_mock = AsyncMock(return_value=None)
    update_state_mock = AsyncMock(return_value=None)
    set_active_mock = AsyncMock(return_value=None)
    bulk_update_mock = AsyncMock(return_value=None)
    fetch_revision_mock = AsyncMock(return_value=[published_row])

    with patch("envmon_backend.spatial_config.application.layout_publish.fetch_draft_revision",
               new=AsyncMock(return_value=[_DRAFT_ROW])), \
         patch("envmon_backend.spatial_config.application.layout_publish.validate_draft_layout",
               new=AsyncMock(return_value=_CLEAN_VALIDATION)), \
         patch("envmon_backend.spatial_config.application.layout_publish.zones_dal.fetch_zones",
               new=AsyncMock(return_value=[])), \
         patch("envmon_backend.spatial_config.application.layout_publish.supersede_active_revision",
               new=supersede_mock), \
         patch("envmon_backend.spatial_config.application.layout_publish.update_revision_state",
               new=update_state_mock), \
         patch("envmon_backend.spatial_config.application.layout_publish.set_active_revision",
               new=set_active_mock), \
         patch("envmon_backend.spatial_config.application.layout_publish.coordinates_dal.fetch_studio_coordinates",
               new=AsyncMock(return_value=[])), \
         patch("envmon_backend.spatial_config.application.layout_publish.coordinates_dal.bulk_update_coordinate_zone_assignments",
               new=bulk_update_mock), \
         patch("envmon_backend.spatial_config.application.layout_publish.fetch_revision",
               new=fetch_revision_mock):
        result = await publish_layout("token", "P225", "F1", "rev-draft", "Added zones", "tim@example.com")

    supersede_mock.assert_called_once_with("token", "P225", "F1")
    set_active_mock.assert_called_once_with("token", "P225", "F1", "rev-draft")
    bulk_update_mock.assert_called_once()
    assert isinstance(result, LayoutRevision)


# ---------------------------------------------------------------------------
# rollback_layout — stub
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_rollback_raises_not_implemented():
    with pytest.raises(NotImplementedError, match="Rollback"):
        await rollback_layout("token", "P225", "F1", "rev-001", "undo", "tim@example.com")


# ---------------------------------------------------------------------------
# get_published_layout — no revision
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_get_published_layout_no_revision_returns_null_revision():
    with patch("envmon_backend.spatial_config.application.layout_publish.fetch_active_revision",
               new=AsyncMock(return_value=[])), \
         patch("envmon_backend.spatial_config.application.layout_publish.coordinates_dal.fetch_mapped_locations",
               new=AsyncMock(return_value=[])):
        result = await get_published_layout("token", "P225", "F1")

    assert result["revision"] is None
    assert result["zones"] == []


# ---------------------------------------------------------------------------
# get_draft_layout — no draft
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_get_draft_layout_returns_none_when_no_draft():
    with patch("envmon_backend.spatial_config.application.layout_publish.fetch_draft_revision",
               new=AsyncMock(return_value=[])):
        result = await get_draft_layout("token", "P225", "F1")
    assert result is None
