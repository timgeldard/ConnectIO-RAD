"""
Core Domain-Driven Design building blocks.
"""

from .events import DomainEvent, DomainEventHandler, DomainEventPublisher
from .exceptions import BusinessRuleValidationException, DomainException, EntityNotFoundError
from .models import AggregateRoot, Entity, ValueObject
from .repository import Repository
from .manufacturing import PlantId, Quantity, PlantScope

__all__ = [
    "DomainEvent",
    "DomainEventHandler",
    "DomainEventPublisher",
    "DomainException",
    "EntityNotFoundError",
    "BusinessRuleValidationException",
    "Entity",
    "AggregateRoot",
    "ValueObject",
    "Repository",
    "PlantId",
    "Quantity",
    "PlantScope",
    "WorkCenterId",
    "GoodsMovement",
]
