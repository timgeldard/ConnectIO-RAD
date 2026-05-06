"""Application service for user preference persistence."""

from connectedquality_backend.user_preferences.dal.prefs_store import get_pinned, set_pinned

__all__ = ["get_pinned", "set_pinned"]
