"""Tests for ``backend.utils`` — required vs optional artifact classification.

Each test runs against a freshly-cleared ``_missing_optional_artifacts``
tracker via the ``reset_optional_artifacts`` autouse fixture below; otherwise
the global accumulates entries across tests and assertions become
order-dependent.
"""

import pytest

from backend.utils import (
    RequiredArtifactMissing,
    _missing_optional_artifacts,
    _optional_attr,
    get_missing_optional_artifacts,
)


@pytest.fixture(autouse=True)
def reset_optional_artifacts():
    """Clear the module-level optional-artifact tracker before and after each test.

    The tracker is a soft singleton mutated at import time. Clearing it on
    setup and teardown isolates test state and removes ordering coupling.
    """
    _missing_optional_artifacts.clear()
    try:
        yield
    finally:
        _missing_optional_artifacts.clear()


def test_required_import_raises_on_missing_module():
    """A required artifact that fails to import aborts startup.

    Verifies the contract that callers using ``required=True`` propagate
    ``RequiredArtifactMissing`` (rather than getting ``None`` back) so the
    platform can refuse to start with a partial route surface.
    """
    with pytest.raises(RequiredArtifactMissing) as exc_info:
        _optional_attr(
            "definitely_not_a_real_module_xyz", "router", required=True
        )
    assert "definitely_not_a_real_module_xyz" in str(exc_info.value)


def test_optional_import_returns_none_on_missing_module():
    """An optional artifact that fails to import logs a warning and returns None.

    Also confirms the module name is recorded in the failure tracker so
    ``GET /api/health/routers`` can surface the optional gap to ops.
    """
    result = _optional_attr(
        "definitely_not_a_real_module_xyz", "router", required=False
    )
    assert result is None
    failures = get_missing_optional_artifacts()
    assert "definitely_not_a_real_module_xyz" in failures


def test_required_import_returns_attribute_when_module_exists():
    """A required import succeeds and returns the named attribute.

    Uses ``logging.getLogger`` as a stable real attribute on a real module
    so the test never depends on the platform's own router inventory.
    """
    getter = _optional_attr("logging", "getLogger", required=True)
    assert callable(getter)


def test_optional_artifact_key_defaults_to_module_name():
    """Per-module artifact keys prevent unrelated routers from sharing a slot.

    The pre-2026-05-07 implementation keyed every W360 router under one
    ``"warehouse360_backend"`` bucket, so a single broken router clobbered
    the readiness signal for unrelated ones. After the C3 fix the key is
    the module path, and this test pins that contract.
    """
    _optional_attr("nonexistent_module_a", "router", required=False)
    _optional_attr("nonexistent_module_b", "router", required=False)
    failures = get_missing_optional_artifacts()
    assert "nonexistent_module_a" in failures
    assert "nonexistent_module_b" in failures
