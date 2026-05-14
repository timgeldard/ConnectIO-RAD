"""Domain model for a spatial layout revision.

LayoutRevision is a mutable entity that tracks the lifecycle state of a
floor layout (draft → published → superseded or rolled_back).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


_VALID_STATES = frozenset({"draft", "published", "superseded", "rolled_back"})


@dataclass
class LayoutRevision:
    """Entity representing a versioned spatial layout for a plant floor.

    Each floor can have at most one draft and one published revision at any time.
    Publishing a revision supersedes the previously published one.

    Invariants:
        - revision_id, plant_id, floor_id, created_by are non-empty.
        - revision_number is positive.
        - state is one of 'draft', 'published', 'superseded', 'rolled_back'.

    Args:
        revision_id: UUID for this revision.
        plant_id: SAP 4-character plant code.
        floor_id: Short floor identifier, e.g. F1.
        revision_number: Monotonically increasing per (plant_id, floor_id).
        state: Current lifecycle state.
        base_revision_id: UUID of the revision this draft branched from; None for first.
        change_reason: Human-readable reason supplied at publish time; None until published.
        created_by: Identity (email or service principal) that created this revision.
        created_at: Creation timestamp (UTC).
    """

    revision_id: str
    plant_id: str
    floor_id: str
    revision_number: int
    state: str
    base_revision_id: str | None
    change_reason: str | None
    created_by: str
    created_at: datetime

    def __post_init__(self) -> None:
        """Validate revision invariants after construction.

        Raises:
            ValueError: If any required field is empty, revision_number is not
                positive, or state is not a recognised lifecycle value.
        """
        for field_name in ("revision_id", "plant_id", "floor_id", "created_by"):
            if not getattr(self, field_name):
                raise ValueError(f"{field_name} must not be empty")
        if self.revision_number < 1:
            raise ValueError(f"revision_number must be >= 1, got {self.revision_number}")
        if self.state not in _VALID_STATES:
            raise ValueError(
                f"state must be one of {sorted(_VALID_STATES)}, got '{self.state}'"
            )

    # ------------------------------------------------------------------
    # State queries
    # ------------------------------------------------------------------

    def is_publishable(self) -> bool:
        """Return True if this revision is in a state that allows publishing.

        Only draft revisions may be published; attempting to publish any other
        state is a domain rule violation.
        """
        return self.state == "draft"

    def is_active(self) -> bool:
        """Return True if this revision is the currently published layout.

        An active revision is the authoritative layout for the floor — its
        zone coordinates are what the heatmap query resolves against.
        """
        return self.state == "published"
