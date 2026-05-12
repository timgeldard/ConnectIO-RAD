"""Pydantic request/response models for the composable dashboard API.

These models define the JSON contract between the platform backend and the
React frontend. Response models use camelCase field names (following the
existing ``GenieAttachment`` / ``GenieMessageResponse`` convention). Request
models use snake_case Python names with camelCase ``Field(alias=...)`` where
needed.

The ``ComposableDashboardConfig`` schema mirrors the Zod
``composableDashboardConfigSchema`` defined in ``libs/shared-reporting``.
"""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class WidgetLayout(BaseModel):
    """Grid position and size for a widget, using react-grid-layout coordinates.

    ``x`` and ``y`` are column/row offsets; ``w`` and ``h`` are column/row spans.
    ``minW`` / ``minH`` enforce minimum resize bounds in the builder.
    """

    x: int = 0
    y: int = 0
    w: int = 4
    h: int = 4
    minW: int = 2
    minH: int = 2


class ComposableWidget(BaseModel):
    """A single widget instance placed in a composable dashboard grid.

    ``type`` must match a key in the frontend widget registry.
    ``props`` carries widget-specific configuration (chart options, KPI metric, etc.).
    """

    id: str
    type: str
    title: Optional[str] = None
    layout: WidgetLayout = Field(default_factory=WidgetLayout)
    props: dict[str, Any] = Field(default_factory=dict)


class ComposableDashboardConfig(BaseModel):
    """Full layout and widget configuration for a composable dashboard.

    Serialised as JSON into ``dashboard_versions.config_json``.
    ``globalFilters`` are filter definitions shared across all widgets.
    """

    columns: int = 12
    rowHeight: int = 80
    widgets: list[ComposableWidget] = Field(default_factory=list)
    globalFilters: list[dict[str, Any]] = Field(default_factory=list)
    autoRefreshSeconds: Optional[int] = None


class DashboardSummary(BaseModel):
    """Lightweight dashboard record returned in list responses.

    Field names are camelCase to match the JavaScript/TypeScript frontend
    convention (consistent with GenieMessageResponse in the POH backend).
    """

    id: str
    title: str
    description: Optional[str] = None
    ownerEmail: str
    isPublic: bool
    tags: list[str]
    version: int
    createdAt: str
    updatedAt: str


class DashboardDetail(DashboardSummary):
    """Full dashboard record including the composable widget config.

    Returned by ``GET /api/dashboards/{id}`` and ``POST /api/dashboards``.
    """

    config: ComposableDashboardConfig


class DashboardListResponse(BaseModel):
    """Response envelope for the dashboard list endpoint."""

    dashboards: list[DashboardSummary]
    total: int


class CreateDashboardRequest(BaseModel):
    """Request body for ``POST /api/dashboards``.

    Accepts both camelCase (``isPublic``) and snake_case (``is_public``)
    field names via ``populate_by_name=True``.
    """

    model_config = ConfigDict(populate_by_name=True)

    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    config: ComposableDashboardConfig = Field(default_factory=ComposableDashboardConfig)
    is_public: bool = Field(default=False, alias="isPublic")
    tags: list[str] = Field(default_factory=list)


class DashboardShare(BaseModel):
    """A single share record — one user explicitly granted access to a dashboard."""

    dashboardId: str
    sharedWithEmail: str
    sharedByEmail: str
    sharedAt: str


class DashboardShareListResponse(BaseModel):
    """Response envelope for the dashboard shares list endpoint."""

    shares: list[DashboardShare]
    total: int


class ShareRequest(BaseModel):
    """Request body for ``POST /api/dashboards/{id}/shares``.

    ``email`` is the recipient; the caller (owner) is taken from the proxy identity.
    """

    email: str = Field(min_length=1, max_length=254)


class UpdateDashboardRequest(BaseModel):
    """Request body for ``PUT /api/dashboards/{id}``.

    ``config`` is required — PUT always stores a full config snapshot.
    All other fields are optional; omitting them keeps the existing value.
    Accepts both camelCase (``isPublic``) and snake_case (``is_public``).
    """

    model_config = ConfigDict(populate_by_name=True)

    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    config: ComposableDashboardConfig
    is_public: Optional[bool] = Field(default=None, alias="isPublic")
    tags: Optional[list[str]] = None
