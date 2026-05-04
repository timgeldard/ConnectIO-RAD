# shared-domain

Core Domain-Driven Design (DDD) building blocks for the ConnectIO-RAD monorepo.

Provides standard abstractions for:
- `Entity`
- `AggregateRoot`
- `ValueObject`
- `DomainEvent`
- `DomainEventPublisher`
- `Repository`
- `DomainException`

`DomainEventPublisher` is a synchronous in-memory dispatcher. It is intended for
application-layer orchestration and tests; durable delivery remains an
infrastructure concern outside the domain layer.
