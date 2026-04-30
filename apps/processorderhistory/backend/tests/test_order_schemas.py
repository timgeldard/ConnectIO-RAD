"""Tests for OrderListRequest schema — limit field validator."""
from backend.schemas.order_schemas import OrderListRequest


def test_limit_below_minimum_clamped_to_one():
    """Ensure that a limit below 1 is clamped to 1."""
    assert OrderListRequest(limit=0).limit == 1


def test_limit_above_maximum_clamped_to_5000():
    """Ensure that a limit above 5000 is clamped to 5000."""
    assert OrderListRequest(limit=10000).limit == 5000


def test_limit_negative_clamped_to_one():
    """Ensure that a negative limit is clamped to 1."""
    assert OrderListRequest(limit=-100).limit == 1


def test_limit_in_range_unchanged():
    """Ensure that a limit within the valid range [1, 5000] remains unchanged."""
    assert OrderListRequest(limit=500).limit == 500


def test_limit_at_minimum_boundary():
    """Verify that a limit exactly at the minimum boundary (1) is accepted."""
    assert OrderListRequest(limit=1).limit == 1


def test_limit_at_maximum_boundary():
    """Verify that a limit exactly at the maximum boundary (5000) is accepted."""
    assert OrderListRequest(limit=5000).limit == 5000


def test_limit_defaults_to_2000():
    """Verify the default limit value of 2000."""
    assert OrderListRequest().limit == 2000


def test_plant_id_defaults_to_none():
    """Verify the default plant_id value of None."""
    assert OrderListRequest().plant_id is None
