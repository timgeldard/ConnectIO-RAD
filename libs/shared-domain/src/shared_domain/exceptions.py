"""Base exception hierarchy for the domain layer."""

class DomainException(Exception):
    """Base exception for all domain logic failures."""
    
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message

class EntityNotFoundError(DomainException):
    """Raised when a requested entity cannot be found by its identity."""
    pass

class BusinessRuleValidationException(DomainException):
    """Raised when an invariant or business rule is violated."""
    pass
