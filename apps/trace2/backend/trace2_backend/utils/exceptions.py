"""
Custom exceptions for the Trace2 application.
"""
from fastapi import status
from shared_api.errors import DomainError

class TraceNotFound(DomainError):
    """
    Raised when traceability data for a material/batch identity is not found.
    """
    def __init__(self, message: str):
        super().__init__(message, status_code=status.HTTP_404_NOT_FOUND)


