"""Unit tests for order_fulfillment domain — delivery and process order status."""

import pytest

from backend.order_fulfillment.domain.delivery_status import (
    DeliveryStatus,
    is_active_delivery,
    normalize_delivery_status,
)
from backend.order_fulfillment.domain.order_status import (
    ProcessOrderStatus,
    is_open_order,
    normalize_po_status,
)


class TestNormalizeDeliveryStatus:
    def test_pending_variants(self) -> None:
        assert normalize_delivery_status("PENDING") == "PENDING"
        assert normalize_delivery_status("OPEN") == "PENDING"
        assert normalize_delivery_status("CREATED") == "PENDING"

    def test_processing_variants(self) -> None:
        assert normalize_delivery_status("PROCESSING") == "PROCESSING"
        assert normalize_delivery_status("PICKING") == "PROCESSING"
        assert normalize_delivery_status("PACKING") == "PROCESSING"
        assert normalize_delivery_status("PACKED") == "PROCESSING"

    def test_shipped_variants(self) -> None:
        assert normalize_delivery_status("SHIPPED") == "SHIPPED"
        assert normalize_delivery_status("IN TRANSIT") == "SHIPPED"
        assert normalize_delivery_status("IN_TRANSIT") == "SHIPPED"
        assert normalize_delivery_status("DISPATCHED") == "SHIPPED"

    def test_delivered_variants(self) -> None:
        assert normalize_delivery_status("DELIVERED") == "DELIVERED"
        assert normalize_delivery_status("GOODS ISSUED") == "DELIVERED"
        assert normalize_delivery_status("GOODS_ISSUED") == "DELIVERED"

    def test_cancelled_variants(self) -> None:
        assert normalize_delivery_status("CANCELLED") == "CANCELLED"
        assert normalize_delivery_status("CANCELED") == "CANCELLED"
        assert normalize_delivery_status("REVERSED") == "CANCELLED"

    def test_case_insensitive(self) -> None:
        assert normalize_delivery_status("shipped") == "SHIPPED"
        assert normalize_delivery_status("Delivered") == "DELIVERED"

    def test_none_defaults_to_pending(self) -> None:
        assert normalize_delivery_status(None) == "PENDING"

    def test_unknown_value_defaults_to_pending(self) -> None:
        assert normalize_delivery_status("SOME_SAP_CODE") == "PENDING"


class TestIsActiveDelivery:
    def test_pending_is_active(self) -> None:
        assert is_active_delivery("PENDING") is True

    def test_processing_is_active(self) -> None:
        assert is_active_delivery("PROCESSING") is True

    def test_shipped_is_not_active(self) -> None:
        assert is_active_delivery("SHIPPED") is False

    def test_delivered_is_not_active(self) -> None:
        assert is_active_delivery("DELIVERED") is False

    def test_cancelled_is_not_active(self) -> None:
        assert is_active_delivery("CANCELLED") is False


class TestNormalizePoStatus:
    def test_created_variants(self) -> None:
        assert normalize_po_status("CREATED") == "CREATED"
        assert normalize_po_status("NEW") == "CREATED"
        assert normalize_po_status("PLANNED") == "CREATED"

    def test_released_variants(self) -> None:
        assert normalize_po_status("RELEASED") == "RELEASED"
        assert normalize_po_status("REL") == "RELEASED"
        assert normalize_po_status("PARTIALLY RELEASED") == "RELEASED"
        assert normalize_po_status("PARTIALLY_RELEASED") == "RELEASED"

    def test_in_progress_variants(self) -> None:
        assert normalize_po_status("IN PROGRESS") == "IN_PROGRESS"
        assert normalize_po_status("IN_PROGRESS") == "IN_PROGRESS"
        assert normalize_po_status("ACTIVE") == "IN_PROGRESS"
        assert normalize_po_status("PARTIALLY CONFIRMED") == "IN_PROGRESS"

    def test_completed_variants(self) -> None:
        assert normalize_po_status("COMPLETED") == "COMPLETED"
        assert normalize_po_status("CONFIRMED") == "COMPLETED"
        assert normalize_po_status("PARTIALLY DELIVERED") == "COMPLETED"

    def test_closed_variants(self) -> None:
        assert normalize_po_status("CLOSED") == "CLOSED"
        assert normalize_po_status("TECHNICALLY COMPLETED") == "CLOSED"
        assert normalize_po_status("TECHNICALLY_COMPLETED") == "CLOSED"
        assert normalize_po_status("TECO") == "CLOSED"

    def test_case_insensitive(self) -> None:
        assert normalize_po_status("released") == "RELEASED"
        assert normalize_po_status("Closed") == "CLOSED"

    def test_none_defaults_to_created(self) -> None:
        assert normalize_po_status(None) == "CREATED"

    def test_unknown_defaults_to_created(self) -> None:
        assert normalize_po_status("SOME_CODE_99") == "CREATED"


class TestIsOpenOrder:
    def test_created_is_open(self) -> None:
        assert is_open_order("CREATED") is True

    def test_released_is_open(self) -> None:
        assert is_open_order("RELEASED") is True

    def test_in_progress_is_open(self) -> None:
        assert is_open_order("IN_PROGRESS") is True

    def test_completed_is_not_open(self) -> None:
        assert is_open_order("COMPLETED") is False

    def test_closed_is_not_open(self) -> None:
        assert is_open_order("CLOSED") is False
