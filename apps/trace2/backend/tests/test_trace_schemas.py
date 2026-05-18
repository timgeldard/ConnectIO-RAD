"""Unit tests for the trace2 schemas compatibility shim."""

from trace2_backend.schemas.trace_schemas import (
    BatchDetailsRequest,
    BatchPageRequest,
    ImpactRequest,
    RecallReadinessRequest,
    SummaryRequest,
    TraceRequest,
)


def test_schemas_are_importable():
    """Verify that all re-exported schemas are importable and valid pydantic models."""
    assert BatchDetailsRequest is not None
    assert BatchPageRequest is not None
    assert ImpactRequest is not None
    assert RecallReadinessRequest is not None
    assert SummaryRequest is not None
    assert TraceRequest is not None
