"""Base exception hierarchy for the domain layer."""


class DomainException(Exception):
    """
    Base class for all exceptions originating in the domain layer.

    Used to distinguish business logic failures from infrastructure or
    transport-level errors.
    """

    def __init__(self, message: str):
        """
        Initialize the domain exception.

        Args:
            message: Human-readable description of the error.
        """
        super().__init__(message)
        self.message = message


class EntityNotFoundError(DomainException):
    """
    Exception raised when a domain entity cannot be located.

    Typically used by repositories or application services when a specific
    identity does not exist in the persistence layer.
    """

    pass


class BusinessRuleValidationException(DomainException):
    """
    Exception raised when a domain invariant or business rule is violated.

    Used to protect the integrity of entities and value objects by failing
    fast when invalid data is provided during construction or mutation.
    """

    pass
