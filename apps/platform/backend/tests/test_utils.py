"""Tests for backend.utils — required vs optional artifact import classification."""

import pytest

from backend.utils import (
    RequiredArtifactMissing,
    _optional_attr,
    get_missing_optional_artifacts,
)


def test_required_import_raises_on_missing_module():
    """A required artifact that fails to import aborts startup."""
    with pytest.raises(RequiredArtifactMissing) as exc_info:
        _optional_attr(
            "definitely_not_a_real_module_xyz", "router", required=True
        )
    assert "definitely_not_a_real_module_xyz" in str(exc_info.value)


def test_optional_import_returns_none_on_missing_module():
    """An optional artifact that fails to import logs a warning and returns None."""
    result = _optional_attr(
        "definitely_not_a_real_module_xyz", "router", required=False
    )
    assert result is None
    failures = get_missing_optional_artifacts()
    assert "definitely_not_a_real_module_xyz" in failures


def test_required_import_returns_attribute_when_module_exists():
    """A required import succeeds and returns the named attribute."""
    # logging.getLogger is a stable real attribute on a real module.
    getter = _optional_attr("logging", "getLogger", required=True)
    assert callable(getter)


def test_optional_artifact_key_defaults_to_module_name():
    """Per-module artifact keys prevent unrelated routers from sharing a slot."""
    _optional_attr("nonexistent_module_a", "router", required=False)
    _optional_attr("nonexistent_module_b", "router", required=False)
    failures = get_missing_optional_artifacts()
    assert "nonexistent_module_a" in failures
    assert "nonexistent_module_b" in failures
