"""Domain event definitions and in-memory dispatching."""

from abc import ABC
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable, Iterable, TypeVar
import uuid


@dataclass(frozen=True)
class DomainEvent(ABC):
    """
    Base class for all domain events.

    A domain event represents something that happened in the domain that
    other parts of the same domain (or other domains) might be interested in.

    Attributes:
        event_id: Unique identifier for this event instance.
        occurred_at: UTC timestamp when the event was created.
    """

    event_id: str = field(default_factory=lambda: str(uuid.uuid4()), init=False)
    occurred_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc), init=False)


TEvent = TypeVar("TEvent", bound=DomainEvent)
DomainEventHandler = Callable[[TEvent], None]


class DomainEventPublisher:
    """
    Simple synchronous in-memory publisher for domain events.

    This intentionally stays infrastructure-free. Applications can use it for
    local side effects today and adapt the same event contracts to a durable bus
    later without changing aggregate/domain model code.
    """

    def __init__(self) -> None:
        """Initialize the publisher with an empty handler map."""
        self._handlers: dict[type[DomainEvent], list[DomainEventHandler]] = defaultdict(list)

    def subscribe(self, event_type: type[TEvent], handler: DomainEventHandler[TEvent]) -> None:
        """
        Register a handler for a domain event type.

        Args:
            event_type: The class of the event to listen for.
            handler: A callable that accepts an event instance.
        """

        self._handlers[event_type].append(handler)

    def unsubscribe(self, event_type: type[TEvent], handler: DomainEventHandler[TEvent]) -> None:
        """
        Remove a previously registered handler if present.

        Args:
            event_type: The class of the event being listened for.
            handler: The callable instance to remove.
        """

        handlers = self._handlers.get(event_type, [])
        if handler in handlers:
            handlers.remove(handler)
        if not handlers and event_type in self._handlers:
            del self._handlers[event_type]

    def publish(self, event: DomainEvent) -> None:
        """
        Synchronously publish one event to exact-type and base-type handlers.

        Args:
            event: The DomainEvent instance to dispatch.
        """

        for event_type, handlers in tuple(self._handlers.items()):
            if isinstance(event, event_type):
                for handler in tuple(handlers):
                    handler(event)

    def publish_all(self, events: Iterable[DomainEvent]) -> None:
        """
        Publish a sequence of events in order.

        Args:
            events: An iterable of DomainEvent instances.
        """

        for event in events:
            self.publish(event)
