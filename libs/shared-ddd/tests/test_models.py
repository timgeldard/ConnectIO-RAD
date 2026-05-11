import pytest
from dataclasses import dataclass
from decimal import Decimal


    AuditMixin,
    AuditStamp,
    Batch,
    BatchId,
    DomainEvent,
    DomainEventPublisher,
    Entity,
    AggregateRoot,
    Material,
    MaterialId,
    Measurement,
    parse_layered_module_path,
    PlantId,
    Specification,
    ValueObject,
    is_infrastructure_import,
)

@dataclass(frozen=True)
class Address(ValueObject):
    street: str
    city: str

class User(Entity[str]):
    pass

class Order(AggregateRoot[str]):
    pass

@dataclass(frozen=True)
class OrderCreated(DomainEvent):
    order_id: str

def test_value_object_equality():
    a1 = Address(street="123 Main", city="Anytown")
    a2 = Address(street="123 Main", city="Anytown")
    a3 = Address(street="456 Elm", city="Othertown")
    
    assert a1 == a2
    assert a1 != a3
    assert hash(a1) == hash(a2)
    assert hash(a1) != hash(a3)


def test_audit_stamp_created_defaults_to_system_actor():
    stamp = AuditStamp.created(system="unit-test")

    assert stamp.created_by == "unit-test"
    assert stamp.updated_at is None
    assert stamp.created_at.tzinfo is not None


def test_audit_mixin_records_immutable_trail():
    class AuditedThing(AuditMixin):
        pass

    thing = AuditedThing(audit=AuditStamp.created(system="unit-test"))
    thing.record_audit(actor="qa@example.com", action="reviewed", note="looks good")

    assert thing.audit.created_by == "unit-test"
    assert thing.audit_trail[0].actor == "qa@example.com"
    assert thing.audit_trail[0].action == "reviewed"

def test_entity_equality_by_identity():
    u1 = User(identity="user-1")
    u2 = User(identity="user-1")
    u3 = User(identity="user-2")
    
    assert u1 == u2
    assert u1 != u3
    assert hash(u1) == hash(u2)
    assert hash(u1) != hash(u3)

def test_entity_identity_cannot_be_none():
    with pytest.raises(ValueError):
        User(identity=None)

def test_aggregate_root_domain_events():
    order = Order(identity="order-1")
    assert len(order.domain_events) == 0
    
    event = OrderCreated(order_id="order-1")
    order.register_event(event)
    
    assert len(order.domain_events) == 1
    assert order.domain_events[0] == event
    
    order.clear_events()
    assert len(order.domain_events) == 0


def test_domain_event_publisher_invokes_subscribed_handler():
    publisher = DomainEventPublisher()
    seen: list[OrderCreated] = []

    publisher.subscribe(OrderCreated, seen.append)
    event = OrderCreated(order_id="order-1")
    publisher.publish(event)

    assert seen == [event]


def test_domain_event_publisher_matches_base_event_handlers():
    publisher = DomainEventPublisher()
    seen: list[DomainEvent] = []

    publisher.subscribe(DomainEvent, seen.append)
    event = OrderCreated(order_id="order-1")
    publisher.publish(event)

    assert seen == [event]


def test_domain_event_publisher_unsubscribe_removes_handler():
    publisher = DomainEventPublisher()
    seen: list[OrderCreated] = []

    publisher.subscribe(OrderCreated, seen.append)
    publisher.unsubscribe(OrderCreated, seen.append)
    publisher.publish(OrderCreated(order_id="order-1"))

    assert seen == []


def test_domain_event_publisher_publish_all_preserves_order():
    publisher = DomainEventPublisher()
    seen: list[str] = []

    publisher.subscribe(OrderCreated, lambda event: seen.append(event.order_id))
    publisher.publish_all([
        OrderCreated(order_id="order-1"),
        OrderCreated(order_id="order-2"),
    ])

    assert seen == ["order-1", "order-2"]


def test_manufacturing_measurement_and_specification():
    measurement = Measurement.now(5.0, "kg")
    specification = Specification(lower=Decimal("4.5"), upper=Decimal("5.5"), unit="kg")

    assert specification.contains(measurement)


def test_manufacturing_identity_objects_normalize_values():
    material = Material(material_id=MaterialId(" mat-1 "), material_name="Demo material")
    batch = Batch(batch_id=BatchId(" b-1 "), material_id=material.material_id, plant_id=PlantId(" p001 "))

    assert material.material_id == "MAT-1"
    assert batch.batch_id == "B-1"
    assert batch.plant_id == "P001"


def test_guardrail_helpers_parse_layered_paths():
    parsed = parse_layered_module_path(
        __import__("pathlib").Path("apps/spc/backend/spc_backend/process_control/domain/models.py")
    )

    assert parsed is not None
    assert parsed.app_name == "spc"
    assert parsed.context_name == "process_control"
    assert parsed.layer == "domain"
    assert is_infrastructure_import("fastapi") is True
    assert is_infrastructure_import("shared_domain") is False
