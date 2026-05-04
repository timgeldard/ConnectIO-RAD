import pytest
from dataclasses import dataclass
from shared_domain import Entity, AggregateRoot, ValueObject, DomainEvent, DomainEventPublisher

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
