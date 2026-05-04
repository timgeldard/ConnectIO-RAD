"""Repository abstraction for domain models."""
from abc import ABC, abstractmethod
from typing import Generic, TypeVar, Optional

from .models import AggregateRoot

TAggregate = TypeVar("TAggregate", bound=AggregateRoot)
TIdentity = TypeVar("TIdentity")

class Repository(ABC, Generic[TAggregate, TIdentity]):
    """
    Base interface for Repositories.
    Repositories mediate between the domain and data mapping layers
    using a collection-like interface for accessing domain objects.
    """
    
    @abstractmethod
    async def get(self, identity: TIdentity) -> Optional[TAggregate]:
        """Fetch an aggregate root by its identity."""
        pass
        
    @abstractmethod
    async def save(self, aggregate: TAggregate) -> None:
        """Persist an aggregate root and its nested entities."""
        pass
