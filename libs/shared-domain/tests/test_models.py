import pytest
from dataclasses import dataclass
from shared_domain import Entity, AggregateRoot, ValueObject, DomainEvent

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
