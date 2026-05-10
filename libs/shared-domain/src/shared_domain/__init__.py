"""
Core Domain-Driven Design building blocks.
"""

from .events import DomainEvent, DomainEventHandler, DomainEventPublisher
from .exceptions import BusinessRuleValidationException, DomainException, EntityNotFoundError
from .models import AggregateRoot, AuditMixin, AuditStamp, AuditTrailEntry, Entity, ValueObject
from .repository import Repository
from .manufacturing import Batch, BatchId, Material, MaterialId, Measurement, PlantId, PlantScope, Quantity, Specification
from .guardrails import LayeredModulePath, is_infrastructure_import, parse_layered_module_path

__all__ = [
    "DomainEvent",
    "DomainEventHandler",
    "DomainEventPublisher",
    "DomainException",
    "EntityNotFoundError",
    "BusinessRuleValidationException",
    "Entity",
    "AggregateRoot",
    "AuditMixin",
    "AuditStamp",
    "AuditTrailEntry",
    "ValueObject",
    "Repository",
    "Batch",
    "BatchId",
    "Material",
    "MaterialId",
    "Measurement",
    "PlantId",
    "Quantity",
    "PlantScope",
    "Specification",
    "LayeredModulePath",
    "is_infrastructure_import",
    "parse_layered_module_path",
]
