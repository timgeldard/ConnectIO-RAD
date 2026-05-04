"""Core DDD building blocks for Entities, Value Objects, and Aggregates."""
from abc import ABC
from dataclasses import dataclass
from typing import Any, TypeVar, Generic

from .events import DomainEvent

TIdentity = TypeVar("TIdentity")

@dataclass(frozen=True)
class ValueObject(ABC):
    """
    Base class for Value Objects.
    Value Objects are defined by their attributes rather than an identity.
    Implemented as a frozen dataclass to ensure immutability and value-based equality.
    """
    pass

class Entity(ABC, Generic[TIdentity]):
    """
    Base class for Entities.
    Entities are defined by a unique identity, not their attributes.
    """
    
    def __init__(self, identity: TIdentity):
        if identity is None:
            raise ValueError("Entity identity cannot be None")
        self._identity = identity
        
    @property
    def identity(self) -> TIdentity:
        return self._identity
        
    def __eq__(self, other: Any) -> bool:
        if not isinstance(other, type(self)):
            return False
        return self._identity == other.identity
        
    def __hash__(self) -> int:
        return hash(self._identity)

class AggregateRoot(Entity[TIdentity]):
    """
    Base class for Aggregate Roots.
    Aggregate Roots are entities that control access to a cluster of related objects.
    They are the only objects that can be loaded/saved directly by a Repository,
    and they manage the collection and dispatch of Domain Events.
    """
    
    def __init__(self, identity: TIdentity):
        super().__init__(identity)
        self._domain_events: list[DomainEvent] = []
        
    def register_event(self, event: DomainEvent) -> None:
        """Register a domain event that occurred within this aggregate."""
        self._domain_events.append(event)
        
    def clear_events(self) -> None:
        """Clear all registered domain events."""
        self._domain_events.clear()
        
    @property
    def domain_events(self) -> tuple[DomainEvent, ...]:
        """Get an immutable view of the registered domain events."""
        return tuple(self._domain_events)
