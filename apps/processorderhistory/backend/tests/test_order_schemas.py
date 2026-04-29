"""Tests for OrderListRequest schema — limit field validator."""
from backend.schemas.order_schemas import OrderListRequest


def test_limit_below_minimum_clamped_to_one():
    assert OrderListRequest(limit=0).limit == 1


def test_limit_above_maximum_clamped_to_5000():
    assert OrderListRequest(limit=10000).limit == 5000


def test_limit_negative_clamped_to_one():
    assert OrderListRequest(limit=-100).limit == 1


def test_limit_in_range_unchanged():
    assert OrderListRequest(limit=500).limit == 500


def test_limit_at_minimum_boundary():
    assert OrderListRequest(limit=1).limit == 1


def test_limit_at_maximum_boundary():
    assert OrderListRequest(limit=5000).limit == 5000


def test_limit_defaults_to_2000():
    assert OrderListRequest().limit == 2000


def test_plant_id_defaults_to_none():
    assert OrderListRequest().plant_id is None
